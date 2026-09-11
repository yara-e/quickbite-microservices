import "reflect-metadata";
import request from "supertest";
import {truncateAll, destroyShards} from "../../helpers/db";
import {createApp} from "@/app";

jest.mock("../../../src/lib/core-client/branch.client", () => ({
    getBranch: jest.fn(),
    getBranchesByIds: jest.fn(),
    getBranchProducts: jest.fn(),
    reserveStock: jest.fn(),
    releaseStock: jest.fn(),
}));

jest.mock("../../../src/lib/core-client/address.client", () => ({
    getCustomerAddress: jest.fn(),
    flattenAddress: jest.fn(() => "1 Test St"),
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

describe("Health endpoints", () => {
    beforeEach(async () => {
        await truncateAll();
    });

    afterAll(async () => {
        await destroyShards();
    });

    it("GET /api/health returns 200 when all shards are reachable", async () => {
        const res = await request(app).get("/api/health");

        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.shards.length).toBeGreaterThanOrEqual(2);
        const egHot = res.body.shards.find((s: any) => s.region === "eg" && s.cluster === "hot");
        expect(egHot.ok).toBe(true);
    });

    it("sets correlation headers", async () => {
        const res = await request(app).get("/api/health");
        expect(res.headers["x-correlationid"]).toBeTruthy();
    });
});