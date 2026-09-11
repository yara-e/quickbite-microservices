import "reflect-metadata";
import request from "supertest";
import {truncateAll, destroyShards} from "../../helpers/db";
import {registerWsServerStub} from "../../helpers/ws-stub";
import {customerToken, restaurantOwnerToken, systemAdminToken} from "../../helpers/auth";
import {seedOrder, seedOrderItem} from "../../helpers/seed";
import {OrderStatus} from "@/app/order/enums";
import {createApp} from "@/app";
import {db} from "@/lib/knex/knex";

jest.mock("../../../src/lib/core-client/branch.client", () => ({
    getBranch: jest.fn(),
    getBranchesByIds: jest.fn(),
    getBranchProducts: jest.fn(),
    reserveStock: jest.fn(),
    releaseStock: jest.fn(),
}));
jest.mock("../../../src/lib/core-client/address.client", () => ({
    getCustomerAddress: jest.fn(),
    flattenAddress: jest.fn(() => "1 Main St"),
}));
jest.mock("../../../src/lib/core-client/rbac.client", () => ({
    getPermissionsByRole: jest.fn().mockResolvedValue([
        "orders:read",
        "orders:accept",
        "orders:update",
        "orders:cancel",
        "payments:read",
        "deliveries:assign",
        "finance:read",
        "finance:payout_create",
    ]),
}));
jest.mock("../../../src/lib/messaging/init", () => ({
    messageBroker: {
        connect: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        declareTopology: jest.fn().mockResolvedValue(undefined),
        consume: jest.fn().mockResolvedValue(undefined),
        publish: jest.fn().mockResolvedValue(undefined),
    },
}));
jest.mock("../../../src/app/payment/service/payment.service", () => ({
    PaymentService: class {
        initOnlinePayment = jest.fn().mockResolvedValue({
            session: {id: 1, createdAt: new Date()},
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            dto: {
                sessionId: "1",
                providerSessionId: "kashier-session-1",
                redirectUrl: "https://pay.example/x",
                amount: 6500,
                currency: "EGP",
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            },
        });
        getById = jest.fn();
    },
}));

import {getBranch, getBranchProducts, reserveStock} from "@/lib/core-client/branch.client";
import {getCustomerAddress} from "@/lib/core-client/address.client";

const branchMock = getBranch as jest.Mock;
const productsMock = getBranchProducts as jest.Mock;
const reserveMock = reserveStock as jest.Mock;
const addressMock = getCustomerAddress as jest.Mock;

const ws = registerWsServerStub();
const app = createApp();

const REGION = "eg";

/** Deterministic valid-uuid generator for orders.public_id (column is UUID). */
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const branch = {
    id: 1,
    restaurantId: 10,
    restaurantOwnerId: 11,
    restaurantStatus: "active",
    region: "eg",
    isActive: true,
    acceptOrders: true,
    deliveryFee: 500,
    commissionBps: 0,
    currency: "EGP",
    lat: 30.05,
    lng: 31.24,
    name: "Downtown Branch",
    addressText: "12 Main St",
};

const product = {
    productId: 3,
    name: "Burger",
    imageUrl: null,
    price: 2500,
    stock: 10,
    isAvailable: true,
};
describe("Order endpoints (integration)", () => {
    beforeAll(() => {
        branchMock.mockResolvedValue(branch);
        addressMock.mockResolvedValue({
            id: 2,
            userId: 1,
            label: "Home",
            country: "EG",
            city: "Cairo",
            street: "Main St",
            building: "",
            apartmentNumber: "",
            lat: 30.04,
            lng: 31.23,
        });
        productsMock.mockResolvedValue([product]);
        reserveMock.mockResolvedValue({ok: true, applied: [{productId: 3, newStock: 8}]});
    });

    beforeEach(async () => {
        await truncateAll();
        ws.reset();
    });

    afterAll(async () => {
        await destroyShards();
    });

    describe("POST /api/orders (COD placement)", () => {
        it("creates a real order row + items and emits order.created", async () => {
            const res = await request(app)
                .post("/api/orders")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${customerToken(1)}`])
                .set("Idempotency-Key", "idem-1")
                .send({
                    branchId: 1,
                    customerAddressId: 2,
                    paymentMethod: "cod",
                    items: [{productId: 3, quantity: 2}],
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            const order = res.body.data;
            expect(order.publicId).toBeTruthy();
            expect(order.status).toBe("placed");
            expect(order.total).toBe(6500);
            expect(order.currency).toBe("EGP");
            expect(order.items).toHaveLength(1);
            expect(order.items[0]).toMatchObject({productId: 3, name: "Burger", quantity: 2});

            const row = await db(REGION)("orders").where({public_id: order.publicId}).first();
            expect(row).toBeTruthy();
            expect(Number(row.subtotal)).toBe(5000);

            expect(ws.emissions.some((e) => e.room === "branch:1" && e.event === "order.created")).toBe(true);
        });

        it("rejects unknown regions (no X-Region/query)", async () => {
            const res = await request(app)
                .post("/api/orders")
                .set("Cookie", [`access_token=${customerToken(1)}`])
                .set("Idempotency-Key", "idem-2")
                .send({
                    branchId: 1,
                    customerAddressId: 2,
                    paymentMethod: "cod",
                    items: [{productId: 3, quantity: 2}],
                });

            expect(res.statusCode).toBe(400);
        });

        it("rejects when the branch is not accepting orders", async () => {
            branchMock.mockResolvedValueOnce({...branch, acceptOrders: false});

            const res = await request(app)
                .post("/api/orders")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${customerToken(1)}`])
                .set("Idempotency-Key", "idem-3")
                .send({
                    branchId: 1,
                    customerAddressId: 2,
                    paymentMethod: "cod",
                    items: [{productId: 3, quantity: 2}],
                });

            expect(res.statusCode).toBe(409);
        });
    });
describe("GET /api/orders/:publicId", () => {
        it("lets the customer read their own order", async () => {
            const conn = db(REGION);
            const order = await seedOrder(conn, {region: REGION, customerId: 1, publicId: U(1)});
            await seedOrderItem(conn, order.id, REGION);

            const res = await request(app)
                .get(`/api/orders/${U(1)}`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${customerToken(1)}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.publicId).toBe(U(1));
            expect(res.body.data.items).toHaveLength(1);
        });

        it("denies a customer who does not own the order", async () => {
            const conn = db(REGION);
            await seedOrder(conn, {region: REGION, customerId: 1, publicId: U(2)});

            const res = await request(app)
                .get(`/api/orders/${U(2)}`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${customerToken(99)}`]);

            expect(res.statusCode).toBe(403);
        });
    });

    describe("GET /api/customer/orders", () => {
        it("lists the customer's orders for a year", async () => {
            const conn = db(REGION);
            await seedOrder(conn, {region: REGION, customerId: 1, publicId: U(3)});
            await seedOrder(conn, {region: REGION, customerId: 1, publicId: U(4)});
            await seedOrder(conn, {region: REGION, customerId: 2, publicId: U(5)});

            const res = await request(app)
                .get("/api/customer/orders?year=2026")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${customerToken(1)}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            const ids = res.body.data.map((o: any) => o.publicId);
            expect(ids).toContain(U(3));
            expect(ids).toContain(U(4));
            expect(ids).not.toContain(U(5));
        });
    });

    describe("restaurant-scoped order routes", () => {
        it("lets the restaurant owner list branch orders", async () => {
            const conn = db(REGION);
            await seedOrder(conn, {region: REGION, restaurantId: 10, branchId: 1, publicId: U(6), customerId: 5});

            const res = await request(app)
                .get("/api/restaurants/10/branches/1/orders")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${restaurantOwnerToken(10)}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.map((o: any) => o.publicId)).toContain(U(6));
        });

        it("denies a restaurant user from a different restaurant", async () => {
            const res = await request(app)
                .get("/api/restaurants/20/branches/1/orders")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${restaurantOwnerToken(10)}`]);

            expect(res.statusCode).toBe(403);
        });
    });

    describe("PATCH order status", () => {
        it("lets the restaurant accept a placed order (stamps accepted_at + outbox)", async () => {
            const conn = db(REGION);
            await seedOrder(conn, {region: REGION, restaurantId: 10, branchId: 1, publicId: U(7), customerId: 1});

            const res = await request(app)
                .patch(`/api/restaurants/10/branches/1/orders/${U(7)}/status`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${restaurantOwnerToken(10)}`])
                .set("Idempotency-Key", "idem-status-1")
                .send({status: "accepted"});

            expect(res.statusCode).toBe(200);
            expect(res.body.data.status).toBe("accepted");

            const row = await db(REGION)("orders").where({public_id: U(7)}).first();
            expect(row.accepted_at).not.toBeNull();

            const outbox = await db(REGION)("events_outbox").where({aggregate_id: U(7)}).count("* as n").first();
            expect(Number(outbox?.n ?? 0)).toBeGreaterThanOrEqual(1);

            expect(ws.emissions.some((e) => e.event === "order.status_changed")).toBe(true);
        });

        it("rejects an invalid transition (accepted -> placed)", async () => {
            const conn = db(REGION);
            await seedOrder(conn, {
                region: REGION,
                restaurantId: 10,
                branchId: 1,
                publicId: U(8),
                customerId: 1,
                status: OrderStatus.ACCEPTED,
                acceptedAt: new Date(),
            });

            const res = await request(app)
                .patch(`/api/restaurants/10/branches/1/orders/${U(8)}/status`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${restaurantOwnerToken(10)}`])
                .set("Idempotency-Key", "idem-status-2")
                .send({status: "placed"});

            expect(res.statusCode).toBe(409);
        });

        it("lets the customer cancel within the window", async () => {
            const conn = db(REGION);
            await seedOrder(conn, {
                region: REGION,
                restaurantId: 10,
                branchId: 1,
                publicId: U(9),
                customerId: 1,
                createdAtOffsetSec: -1,
            });

            const res = await request(app)
                .patch(`/api/customer/orders/${U(9)}/status`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${customerToken(1)}`])
                .set("Idempotency-Key", "idem-status-3")
                .send({status: "cancelled", reason: "changed my mind"});

            expect(res.statusCode).toBe(200);
            expect(res.body.data.status).toBe("cancelled");
        });

        it("blocks a customer cancel outside the window", async () => {
            const conn = db(REGION);
            await seedOrder(conn, {
                region: REGION,
                restaurantId: 10,
                branchId: 1,
                publicId: U(10),
                customerId: 1,
                createdAtOffsetSec: -120,
            });

            const res = await request(app)
                .patch(`/api/customer/orders/${U(10)}/status`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${customerToken(1)}`])
                .set("Idempotency-Key", "idem-status-4")
                .send({status: "cancelled", reason: "too late"});

            expect(res.statusCode).toBe(409);
        });

        it("allows a system admin to cancel via the admin endpoint", async () => {
            const conn = db(REGION);
            await seedOrder(conn, {region: REGION, restaurantId: 10, branchId: 1, publicId: U(11), customerId: 1});

            const res = await request(app)
                .patch(`/api/admin/orders/${U(11)}/status`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${systemAdminToken()}`])
                .set("Idempotency-Key", "idem-status-5")
                .send({status: "cancelled", reason: "admin action"});

            expect(res.statusCode).toBe(200);
            expect(res.body.data.status).toBe("cancelled");
        });
    });
});