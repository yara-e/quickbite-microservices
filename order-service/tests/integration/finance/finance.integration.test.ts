import "reflect-metadata";
import request from "supertest";
import {truncateAll, destroyShards} from "../../helpers/db";
import {restaurantOwnerToken, systemAdminToken} from "../../helpers/auth";
import {seedOrder, seedTransaction} from "../../helpers/seed";
import {createApp} from "@/app";
import {db} from "@/lib/knex/knex";
import {TransactionType, TransactionStatus, TransactionMethod} from "@/app/payment/enums";

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

const app = createApp();
const REGION = "eg";
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("Finance endpoints (integration)", () => {
    beforeEach(async () => {
        await truncateAll();
    });

    afterAll(async () => {
        await destroyShards();
    });

    describe("GET /api/restaurants/:restaurantId/balance", () => {
        it("returns the restaurant's balances across currencies", async () => {
            const conn = db(REGION);
            await conn("restaurant_balances").insert({
                restaurant_id: 10,
                region: REGION,
                currency: "EGP",
                balance: 4500,
            });

            const res = await request(app)
                .get("/api/restaurants/10/balance")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${restaurantOwnerToken(10)}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.restaurantId).toBe(10);
            expect(res.body.data.balances).toEqual([{currency: "EGP", balance: 4500}]);
        });

        it("denies a different restaurant", async () => {
            await db(REGION)("restaurant_balances").insert({
                restaurant_id: 10,
                region: REGION,
                currency: "EGP",
                balance: 100,
            });

            const res = await request(app)
                .get("/api/restaurants/10/balance")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${restaurantOwnerToken(99)}`]);

            expect(res.statusCode).toBe(403);
        });
    });

    describe("GET /api/restaurants/:restaurantId/payouts", () => {
        it("lists payout transactions for the restaurant owner", async () => {
            const conn = db(REGION);
            const order = await seedOrder(conn, {region: REGION, restaurantId: 10, restaurantOwnerId: 11, branchId: 1, publicId: U(50), customerId: 5});
            const payout = await seedTransaction(conn, {
                region: REGION,
                orderId: null,
                transactionType: TransactionType.PAYOUT,
                method: TransactionMethod.BANK_TRANSFER,
                status: TransactionStatus.SUCCEEDED,
                amount: 1000,
                dstAccId: 11,
            });
            await seedTransaction(conn, {
                region: REGION,
                orderId: null,
                transactionType: TransactionType.PAYOUT,
                method: TransactionMethod.BANK_TRANSFER,
                status: TransactionStatus.SUCCEEDED,
                amount: 999,
                dstAccId: 9999,
            });

            const res = await request(app)
                .get("/api/restaurants/10/payouts")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${restaurantOwnerToken(10)}`]);

            expect(res.statusCode).toBe(200);
            const ids = res.body.data.map((p: any) => p.id);
            expect(ids).toContain(Number(payout.id));
            expect(ids).toHaveLength(1);
            void order;
        });
    });

    describe("POST /api/admin/restaurants/:restaurantId/payouts", () => {
        it("lets a system admin record a payout and decrements the balance", async () => {
            const conn = db(REGION);
            await conn("restaurant_balances").insert({
                restaurant_id: 10,
                region: REGION,
                currency: "EGP",
                balance: 5000,
            });
            await seedOrder(conn, {region: REGION, restaurantId: 10, restaurantOwnerId: 11, branchId: 1, publicId: U(51), customerId: 5});

            const res = await request(app)
                .post("/api/admin/restaurants/10/payouts")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${systemAdminToken()}`])
                .set("Idempotency-Key", "idem-payout-1")
                .send({
                    amount: 2000,
                    currency: "EGP",
                    providerReferenceId: "bank-ref-1",
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.amount).toBe(2000);

            const balance = await db(REGION)("restaurant_balances")
                .where({restaurant_id: 10, currency: "EGP"})
                .first();
            expect(Number(balance.balance)).toBe(3000);
        });

        it("rejects a payout that would exceed the balance (409)", async () => {
            const conn = db(REGION);
            await conn("restaurant_balances").insert({
                restaurant_id: 10,
                region: REGION,
                currency: "EGP",
                balance: 100,
            });
            await seedOrder(conn, {region: REGION, restaurantId: 10, restaurantOwnerId: 11, branchId: 1, publicId: U(52), customerId: 5});

            const res = await request(app)
                .post("/api/admin/restaurants/10/payouts")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${systemAdminToken()}`])
                .set("Idempotency-Key", "idem-payout-2")
                .send({
                    amount: 5000,
                    currency: "EGP",
                    providerReferenceId: "bank-ref-2",
                });

            expect(res.statusCode).toBe(409);
        });
    });
});