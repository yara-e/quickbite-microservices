import "reflect-metadata"
import request from "supertest"
import { truncateAll } from "../../helpers/db"
import { createUser } from "../../helpers/seed"
import { createApp } from "@/app"

jest.mock("../../../src/lib/email/init", () => ({
    emailProvider: { send: jest.fn() },
}))

import { db } from "@/lib/knex/knex"
import { SystemRole } from "@/app/user/enums"

const app = createApp();

describe("User endpoints", () => {
    let customer: Awaited<ReturnType<typeof createUser>>;

    beforeEach(async () => {
        await truncateAll();
        customer = await createUser({ systemRole: SystemRole.CUSTOMER, name: "Customer One" });
    });

    describe("GET /api/user/me", () => {
        it("requires authentication", async () => {
            const res = await request(app).get("/api/user/me");
            expect(res.statusCode).toBe(401);
        });

        it("returns the authenticated user's profile", async () => {
            const res = await request(app)
                .get("/api/user/me")
                .set("Cookie", [`access_token=${customer.accessToken}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toMatchObject({
                id: customer.user.id,
                email: customer.user.email,
                name: "Customer One",
                systemRole: SystemRole.CUSTOMER,
            });
        });
    });

    describe("PATCH /api/user/me", () => {
        it("updates the profile name and phone", async () => {
            const res = await request(app)
                .patch("/api/user/me")
                .set("Cookie", [`access_token=${customer.accessToken}`])
                .send({ name: "New Name", phone: "01099999999" });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.user.name).toBe("New Name");
            expect(res.body.data.user.phone).toBe("01099999999");

            const stored = await db("users").where({ id: customer.user.id }).first();
            expect(stored.name).toBe("New Name");
        });

        it("validates invalid payloads", async () => {
            const res = await request(app)
                .patch("/api/user/me")
                .set("Cookie", [`access_token=${customer.accessToken}`])
                .send({ name: "" });

            expect(res.statusCode).toBe(400);
        });
    });

    describe("GET /api/user/internal/agents/:id", () => {
        it("requires the internal api key", async () => {
            const res = await request(app).get("/api/user/internal/agents/1");
            expect(res.statusCode).toBe(401);
        });

        it("returns a delivery agent", async () => {
            const agent = await createUser({
                systemRole: SystemRole.DELIVERY_AGENT,
                name: "Rider",
            });
            const res = await request(app)
                .get(`/api/user/internal/agents/${agent.user.id}`)
                .set("api-key", "test-internal-api-key");

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toEqual({
                id: agent.user.id,
                name: "Rider",
                phone: agent.user.phone,
            });
        });

        it("hides non-agent users", async () => {
            const res = await request(app)
                .get(`/api/user/internal/agents/${customer.user.id}`)
                .set("api-key", "test-internal-api-key");

            expect(res.statusCode).toBe(404);
        });
    });
});