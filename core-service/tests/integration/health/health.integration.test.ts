import "reflect-metadata"
import request from "supertest"
import { truncateAll } from "../../helpers/db"
import { createApp } from "@/app"

jest.mock("../../../src/lib/email/init", () => ({
    emailProvider: { send: jest.fn() },
}))

const app = createApp();

describe("Health + misc endpoints", () => {
    beforeEach(async () => {
        await truncateAll();
    });

    it("GET /api/health returns OK when DB is reachable", async () => {
        const res = await request(app).get("/api/health");
        expect(res.statusCode).toBe(200);
        expect(res.text).toBe("OK");
    });

    it("unknown routes fall through to the error handler", async () => {
        const res = await request(app).get("/api/definitely-not-a-route");
        expect(res.statusCode).toBe(404);
    });

    it("sets correlation headers on every request", async () => {
        const res = await request(app).get("/api/health");
        expect(res.headers["x-correlationid"]).toBeTruthy();
    });
});