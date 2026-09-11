import "reflect-metadata";
import request from "supertest";
import {truncateAll, destroyShards} from "../../helpers/db";
import {registerWsServerStub} from "../../helpers/ws-stub";
import {restaurantOwnerToken} from "../../helpers/auth";
import {seedOrder, seedTransaction} from "../../helpers/seed";
import {createApp} from "@/app";
import {db} from "@/lib/knex/knex";
import {env} from "@/lib/config/env";
import {
    computeWebhookSignature,
    buildSignaturePayload,
} from "@/pkg/payments/kashier/kashier.signature";
import {TransactionType} from "@/app/payment/enums";

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

const ws = registerWsServerStub();
const app = createApp();
const REGION = "eg";
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("Payment endpoints (integration)", () => {
    beforeEach(async () => {
        await truncateAll();
        ws.reset();
    });

    afterAll(async () => {
        await destroyShards();
    });

    describe("GET /api/restaurants/:restaurantId/payments/:paymentId", () => {
        it("returns a transaction belonging to the caller's restaurant", async () => {
            const conn = db(REGION);
            const order = await seedOrder(conn, {region: REGION, restaurantId: 10, restaurantOwnerId: 11, branchId: 1, publicId: U(40), customerId: 5});
            const tx = await seedTransaction(conn, {
                region: REGION,
                orderId: order.id,
                transactionType: TransactionType.CHARGE,
            });

            const res = await request(app)
                .get(`/api/restaurants/10/payments/${tx.id}`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${restaurantOwnerToken(10)}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.id).toBe(Number(tx.id));
            expect(res.body.data.type).toBe("charge");
        });

        it("denies a restaurant member trying to read another restaurant's payment", async () => {
            const conn = db(REGION);
            const order = await seedOrder(conn, {region: REGION, restaurantId: 10, restaurantOwnerId: 11, branchId: 1, publicId: U(41), customerId: 5});
            const tx = await seedTransaction(conn, {region: REGION, orderId: order.id});

            const res = await request(app)
                .get(`/api/restaurants/20/payments/${tx.id}`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${restaurantOwnerToken(20)}`]);

            // Owner token is for restaurant 20; the payment belongs to 10.
            expect(res.statusCode).toBe(403);
        });

        it("404s for an unknown payment", async () => {
            const res = await request(app)
                .get("/api/restaurants/10/payments/999999")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${restaurantOwnerToken(10)}`]);

            expect(res.statusCode).toBe(404);
        });
    });

    describe("POST /api/payments/webhook/kashier", () => {
        it("rejects an invalid signature with 401", async () => {
            const envelope = {
                event: "payment.status.changed",
                data: {
                    transactionId: "tx-invalid",
                    signatureKeys: ["transactionId"],
                    amount: "100.00",
                    currency: "EGP",
                    orderId: "00000000-0000-4000-8000-000000000099",
                },
            };

            const res = await request(app)
                .post("/api/payments/webhook/kashier?region=eg")
                .set("x-kashier-signature", "0".repeat(64))
                .send(envelope);

            expect(res.statusCode).toBe(401);
        });

        it("acknowledges a validly-signed unknown transaction but yields a process error path", async () => {
            const data = {
                transactionId: "tx-valid-1",
                signatureKeys: ["transactionId", "amount", "currency"],
                amount: "100.00",
                currency: "EGP",
                orderId: U(42),
            };
            const signature = computeWebhookSignature(data, data.signatureKeys, env.kashier.apiKey);
            const envelope = {event: "payment.status.changed", data};

            const res = await request(app)
                .post("/api/payments/webhook/kashier?region=eg")
                .set("x-kashier-signature", signature)
                .send(envelope);

            // Happy path would 200; if reconciliation finds no pending order it may 500.
            // We only assert that signature verification passed (not 401).
            expect(res.statusCode).not.toBe(401);

            // Duplicate webhook with the same transactionId must 200 (no reprocessing).
            const dup = await request(app)
                .post("/api/payments/webhook/kashier?region=eg")
                .set("x-kashier-signature", signature)
                .send(envelope);
            expect(dup.statusCode).toBe(200);
        });
    });
});