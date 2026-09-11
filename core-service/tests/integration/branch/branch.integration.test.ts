import "reflect-metadata"
import request from "supertest"
import { truncateAll } from "../../helpers/db"
import { createUser, createRestaurantOwner, createRestaurantMemberUser, createBranch, createProduct } from "../../helpers/seed"
import { createApp } from "@/app"

jest.mock("../../../src/lib/email/init", () => ({
    emailProvider: { send: jest.fn() },
}))

import { db } from "@/lib/knex/knex"
import { SystemRole } from "@/app/user/enums"
import { Currency } from "@/app/branch/enums"

const app = createApp();

const branchBody = {
    countryCode: "EG",
    label: "New Branch",
    addressText: "12 Tahrir St",
    lat: 30.0474,
    lng: 31.2338,
    opensAt: "09:00:00",
    closesAt: "22:00:00",
    deliveryRadius: 5,
    currency: Currency.EGP,
};

describe("Branch endpoints", () => {
    let systemAdmin: Awaited<ReturnType<typeof createUser>>;

    beforeEach(async () => {
        await truncateAll();
        systemAdmin = await createUser({ systemRole: SystemRole.SYSTEM_ADMIN });
    });

    describe("GET /api/branches/nearby", () => {
        it("returns active nearby branches of active restaurants", async () => {
            const owner = await createRestaurantOwner({ name: "Nearby Place" });
            await createBranch(owner.restaurant.id, { lat: 30.04, lng: 31.23, label: "Cairo Branch" });

            const res = await request(app).get("/api/branches/nearby?lat=30.04&lng=31.23");

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("GET /api/restaurants/:restaurantId/branches", () => {
        it("lists branches for a restaurant", async () => {
            const owner = await createRestaurantOwner({ name: "List Me" });
            await createBranch(owner.restaurant.id, { label: "Branch A" });
            await createBranch(owner.restaurant.id, { label: "Branch B" });

            const res = await request(app).get(`/api/restaurants/${owner.restaurant.id}/branches`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveLength(2);
        });
    });

    describe("POST /api/restaurants/:restaurantId/branches", () => {
        it("lets the owner create a branch", async () => {
            const owner = await createRestaurantOwner({ name: "Create Here" });

            const res = await request(app)
                .post(`/api/restaurants/${owner.restaurant.id}/branches`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send(branchBody);

            expect(res.statusCode).toBe(201);
            expect(res.body.data.branch).toMatchObject({ label: "New Branch", isActive: false });
        });

        it("denies a user from a different restaurant", async () => {
            const ownerA = await createRestaurantOwner({ name: "A" });
            const ownerB = await createRestaurantOwner({ name: "B" });

            const res = await request(app)
                .post(`/api/restaurants/${ownerA.restaurant.id}/branches`)
                .set("Cookie", [`access_token=${ownerB.accessToken}`])
                .send(branchBody);

            expect(res.statusCode).toBe(403);
        });

        it("validates the payload", async () => {
            const owner = await createRestaurantOwner({ name: "Validate" });

            const res = await request(app)
                .post(`/api/restaurants/${owner.restaurant.id}/branches`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({ label: "Incomplete" });

            expect(res.statusCode).toBe(400);
        });
    });

    describe("PATCH /api/branches/:id", () => {
        it("lets the owner update their branch", async () => {
            const owner = await createRestaurantOwner({ name: "Branch Updater" });
            const branch = await createBranch(owner.restaurant.id, { label: "Before" });

            const res = await request(app)
                .patch(`/api/branches/${branch.id}`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({ label: "After", acceptOrders: false });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.branch.label).toBe("After");
            expect(res.body.data.branch.acceptOrders).toBe(false);

            const outbox = await db("events_outbox").where({ event_type: "branch.updated", aggregate_id: String(branch.id) }).count("* as n").first();
            expect(Number(outbox?.n ?? 0)).toBe(1);
        });

        it("denies a user without access to the branch", async () => {
            const owner = await createRestaurantOwner({ name: "Owner" });
            const branch = await createBranch(owner.restaurant.id, { label: "Branch" });
            const staff = await createRestaurantMemberUser(owner.restaurant.id, "staff", []);

            const res = await request(app)
                .patch(`/api/branches/${branch.id}`)
                .set("Cookie", [`access_token=${staff.accessToken}`])
                .send({ label: "Nope" });

            expect(res.statusCode).toBe(403);
        });
    });

    describe("PATCH /api/branches/:id/status", () => {
        it("lets a system admin deactivate a branch (isActive=false)", async () => {
            const owner = await createRestaurantOwner({ name: "Status" });
            const branch = await createBranch(owner.restaurant.id, { label: "Toggle" });

            const res = await request(app)
                .patch(`/api/branches/${branch.id}/status`)
                .set("Cookie", [`access_token=${systemAdmin.accessToken}`])
                .send({ isActive: false });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.branch.isActive).toBe(false);

            const outbox = await db("events_outbox").where({ event_type: "branch.deactivated" }).count("* as n").first();
            expect(Number(outbox?.n ?? 0)).toBe(1);
        });

        it("rejects non system admins", async () => {
            const owner = await createRestaurantOwner({ name: "Not Allowed" });
            const branch = await createBranch(owner.restaurant.id);

            const res = await request(app)
                .patch(`/api/branches/${branch.id}/status`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({ isActive: false });

            expect(res.statusCode).toBe(403);
        });
    });

    describe("Internal branch endpoints", () => {
        it("GET /api/internal/branches/:id returns the internal DTO", async () => {
            const owner = await createRestaurantOwner({ name: "Internal" });
            const branch = await createBranch(owner.restaurant.id, { label: "Downtown", commission: 5 });

            const res = await request(app)
                .get(`/api/internal/branches/${branch.id}`)
                .set("api-key", "test-internal-api-key");

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toMatchObject({
                id: branch.id,
                restaurantId: owner.restaurant.id,
                restaurantOwnerId: owner.user.id,
                restaurantStatus: "active",
                region: "EG",
                commissionBps: 500,
            });
        });

        it("GET /api/internal/branches?ids=1,2 returns the batched DTOs", async () => {
            const owner = await createRestaurantOwner({ name: "Batch Internal" });
            const b1 = await createBranch(owner.restaurant.id, { label: "One" });
            const b2 = await createBranch(owner.restaurant.id, { label: "Two" });

            const res = await request(app)
                .get(`/api/internal/branches?ids=${b1.id},${b2.id}`)
                .set("api-key", "test-internal-api-key");

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveLength(2);
        });

        it("rejects requests without the internal key", async () => {
            const res = await request(app).get("/api/internal/branches/1");
            expect(res.statusCode).toBe(401);
        });
    });
});