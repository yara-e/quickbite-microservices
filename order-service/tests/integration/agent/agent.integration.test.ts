import "reflect-metadata";
import request from "supertest";
import {truncateAll, destroyShards} from "../../helpers/db";
import {registerWsServerStub} from "../../helpers/ws-stub";
import {agentToken} from "../../helpers/auth";
import {seedOrder} from "../../helpers/seed";
import {OrderStatus} from "@/app/order/enums";
import {createApp} from "@/app";
import {db} from "@/lib/knex/knex";
import {cacheProvider} from "@/lib/cache/init";
import {AssignmentService} from "@/app/assignment/service/assignment.service";
import {PresenceService} from "@/app/agent/service/presence.service";

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
jest.mock("../../../src/lib/messaging/init", () => ({
    messageBroker: {
        connect: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        declareTopology: jest.fn().mockResolvedValue(undefined),
        consume: jest.fn().mockResolvedValue(undefined),
        publish: jest.fn().mockResolvedValue(undefined),
    },
}));

import {getBranch, getBranchesByIds} from "@/lib/core-client/branch.client";

const branchMock = getBranch as jest.Mock;
const branchesMock = getBranchesByIds as jest.Mock;

const ws = registerWsServerStub();
const app = createApp();
const REGION = "eg";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("Agent endpoints (integration)", () => {
    beforeAll(() => {
        branchMock.mockResolvedValue({
            id: 1,
            restaurantId: 10,
            restaurantOwnerId: 11,
            restaurantStatus: "active",
            region: REGION,
            isActive: true,
            acceptOrders: true,
            deliveryFee: 500,
            commissionBps: 0,
            currency: "EGP",
            lat: 30.05,
            lng: 31.24,
            name: "Downtown Branch",
            addressText: "12 Main St",
        });
        branchesMock.mockImplementation((ids: number[]) => {
            const m = new Map<number, any>();
            for (const id of ids) m.set(id, branchMock());
            return Promise.resolve(m);
        });
    });

    beforeEach(async () => {
        await truncateAll();
        ws.reset();
    });

    afterAll(async () => {
        await destroyShards();
    });

    describe("POST /api/agents/presence/online + ping + offline", () => {
        it("upserts presence and then clears on offline", async () => {
            const upsertRes = await request(app)
                .post("/api/agents/presence/online")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${agentToken(7)}`])
                .send({lat: 30.06, lng: 31.25});

            expect(upsertRes.statusCode).toBe(200);
            expect(upsertRes.body.data.ok).toBe(true);

            const meta = await cacheProvider.client.hgetall(PresenceService.metaKey(REGION, 7));
            expect(meta).toBeDefined();
            expect(Object.keys(meta ?? {}).length).toBeGreaterThan(0);

            const pingRes = await request(app)
                .post("/api/agents/presence/ping")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${agentToken(7)}`])
                .send({lat: 30.06, lng: 31.25});
            expect(pingRes.statusCode).toBe(200);

            const offlineRes = await request(app)
                .post("/api/agents/presence/offline")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${agentToken(7)}`]);
            expect(offlineRes.statusCode).toBe(200);

            expect(await cacheProvider.exists(PresenceService.metaKey(REGION, 7))).toBe(false);
        });

        it("rejects a non-agent role", async () => {
            const {customerToken} = await import("../../helpers/auth");
            const res = await request(app)
                .post("/api/agents/presence/online")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${customerToken(1)}`])
                .send({lat: 30, lng: 31});

            expect(res.statusCode).toBe(403);
        });

        it("validates lat/lng", async () => {
            const res = await request(app)
                .post("/api/agents/presence/online")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${agentToken(7)}`])
                .send({lat: 99, lng: 199});

            expect(res.statusCode).toBe(400);
        });
    });

    describe("POST /api/agents/orders/:publicId/accept (claim flow)", () => {
        it("claims a ready order offered to the agent", async () => {
            const conn = db(REGION);
            const publicId = U(20);
            await seedOrder(conn, {
                region: REGION,
                status: OrderStatus.READY,
                publicId,
                restaurantId: 10,
                branchId: 1,
                customerId: 1,
            });

            await cacheProvider.set(AssignmentService.offerKey(publicId), "7", 60);

            const res = await request(app)
                .post(`/api/agents/orders/${publicId}/accept`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${agentToken(7)}`])
                .set("Idempotency-Key", "idem-agent-1");

            expect(res.statusCode).toBe(200);
            expect(res.body.data.orderId).toBe(publicId);
            expect(res.body.data.status).toBe("assigned");

            const row = await db(REGION)("orders").where({public_id: publicId}).first();
            expect(row.status).toBe("assigned");
            expect(Number(row.delivery_agent_id)).toBe(7);

            expect(await cacheProvider.sismember(PresenceService.busyKey(REGION), "7")).toBe(true);
        });

        it("rejects an agent that was not offered the order", async () => {
            const publicId = U(21);
            const conn = db(REGION);
            await seedOrder(conn, {region: REGION, status: OrderStatus.READY, publicId, restaurantId: 10, branchId: 1});

            await cacheProvider.set(AssignmentService.offerKey(publicId), "8", 60);

            const res = await request(app)
                .post(`/api/agents/orders/${publicId}/accept`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${agentToken(7)}`])
                .set("Idempotency-Key", "idem-agent-2");

            expect(res.statusCode).toBe(403);
        });

        it("rejects with no active offer", async () => {
            const publicId = U(22);
            const conn = db(REGION);
            await seedOrder(conn, {region: REGION, status: OrderStatus.READY, publicId, restaurantId: 10, branchId: 1});

            const res = await request(app)
                .post(`/api/agents/orders/${publicId}/accept`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${agentToken(7)}`])
                .set("Idempotency-Key", "idem-agent-3");

            expect(res.statusCode).toBe(404);
        });
    });

    describe("PATCH /api/agents/orders/:publicId/status (picked)", () => {
        it("lets the assigned agent mark an order picked", async () => {
            const conn = db(REGION);
            const publicId = U(23);
            await seedOrder(conn, {
                region: REGION,
                status: OrderStatus.ASSIGNED,
                publicId,
                restaurantId: 10,
                branchId: 1,
                customerId: 1,
                deliveryAgentId: 7,
                assignedAt: new Date(),
            });

            const res = await request(app)
                .patch(`/api/agents/orders/${publicId}/status`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${agentToken(7)}`])
                .set("Idempotency-Key", "idem-agent-4")
                .send({status: OrderStatus.PICKED});

            expect(res.statusCode).toBe(200);
            expect(res.body.data.status).toBe("picked");

            const row = await db(REGION)("orders").where({public_id: publicId}).first();
            expect(row.picked_at).not.toBeNull();
        });

        it("rejects an agent that does not hold the task", async () => {
            const conn = db(REGION);
            const publicId = U(24);
            await seedOrder(conn, {
                region: REGION,
                status: OrderStatus.ASSIGNED,
                publicId,
                restaurantId: 10,
                branchId: 1,
                customerId: 1,
                deliveryAgentId: 8,
                assignedAt: new Date(),
            });

            const res = await request(app)
                .patch(`/api/agents/orders/${publicId}/status`)
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${agentToken(7)}`])
                .set("Idempotency-Key", "idem-agent-5")
                .send({status: OrderStatus.PICKED});

            expect(res.statusCode).toBe(403);
        });
    });

    describe("GET /api/agents/tasks", () => {
        it("lists assigned + picked orders for the agent", async () => {
            const conn = db(REGION);
            await seedOrder(conn, {region: REGION, status: OrderStatus.ASSIGNED, publicId: U(30), restaurantId: 10, branchId: 1, customerId: 1, deliveryAgentId: 7, assignedAt: new Date()});
            await seedOrder(conn, {region: REGION, status: OrderStatus.PICKED, publicId: U(31), restaurantId: 10, branchId: 1, customerId: 1, deliveryAgentId: 7, pickedAt: new Date()});
            await seedOrder(conn, {region: REGION, status: OrderStatus.ASSIGNED, publicId: U(32), restaurantId: 10, branchId: 1, customerId: 1, deliveryAgentId: 8, assignedAt: new Date()});

            const res = await request(app)
                .get("/api/agents/tasks")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${agentToken(7)}`]);

            expect(res.statusCode).toBe(200);
            const ids = res.body.data.map((t: any) => t.orderId);
            expect(ids).toContain(U(30));
            expect(ids).toContain(U(31));
            expect(ids).not.toContain(U(32));
        });
    });

    describe("GET /api/agents/earnings", () => {
        it("returns an empty earnings summary when none exist", async () => {
            const res = await request(app)
                .get("/api/agents/earnings")
                .set("X-Region", REGION)
                .set("Cookie", [`access_token=${agentToken(7)}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.totals).toEqual({count: 0, sum: 0, currency: null});
        });
    });
});