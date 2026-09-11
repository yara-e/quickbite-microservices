import "reflect-metadata"
import request from "supertest"
import { truncateAll } from "../../helpers/db"
import { createUser, createRestaurant, createRestaurantOwner, TEST_PASSWORD, randomPhone } from "../../helpers/seed"
import { createApp } from "@/app"

jest.mock("../../../src/lib/email/init", () => ({
    emailProvider: { send: jest.fn() },
}))

import { db } from "@/lib/knex/knex"
import { SystemRole } from "@/app/user/enums"
import { RestaurantStatus } from "@/app/restaurant/enums"

const app = createApp();

describe("Restaurant endpoints", () => {
    let systemAdmin: Awaited<ReturnType<typeof createUser>>;

    beforeEach(async () => {
        await truncateAll();
        systemAdmin = await createUser({ systemRole: SystemRole.SYSTEM_ADMIN, name: "Root Admin" });
    });

    const createRestaurantPayload = () => ({
        name: "New Restaurant",
        primaryCountry: "EG",
        logoUrl: "https://logo.example/x.png",
        owner: {
            email: `owner-${Date.now()}@test.com`,
            phone: randomPhone(),
            name: "Owner Person",
            password: TEST_PASSWORD,
        },
    });

    describe("POST /api/restaurants", () => {
        it("creates a restaurant with its owner (system admin only)", async () => {
            const res = await request(app)
                .post("/api/restaurants")
                .set("Cookie", [`access_token=${systemAdmin.accessToken}`])
                .send(createRestaurantPayload());

            expect(res.statusCode).toBe(201);
            expect(res.body.data.restaurant).toMatchObject({
                name: "New Restaurant",
                status: RestaurantStatus.ACTIVE,
            });
            expect(res.body.data.owner.systemRole).toBe(SystemRole.RESTAURANT_USER);

            const owners = await db("restaurant_members")
                .join("roles", "roles.id", "restaurant_members.role_id")
                .where("restaurant_members.restaurant_id", res.body.data.restaurant.id)
                .select("roles.name as roleName");
            expect(owners.map((o) => o.roleName)).toContain("owner");
        });

        it("rejects non-system-admins", async () => {
            const customer = await createUser({ systemRole: SystemRole.CUSTOMER });
            const res = await request(app)
                .post("/api/restaurants")
                .set("Cookie", [`access_token=${customer.accessToken}`])
                .send(createRestaurantPayload());

            expect(res.statusCode).toBe(403);
        });
    });

    describe("GET /api/restaurants", () => {
        it("paginates and returns restaurants", async () => {
            const owner = await createRestaurantOwner({ name: "Zed Pizzeria" });
            await createRestaurant(owner.user.id, { name: "Alpha Burgers" });

            const res = await request(app).get("/api/restaurants?limit=1&sortBy=name");

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.hasMore).toBe(true);
        });

        it("filters by status", async () => {
            await createRestaurantOwner({ name: "Active Place" });

            const res = await request(app).get("/api/restaurants?filter[status][eq]=active");
            expect(res.statusCode).toBe(200);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
            expect(res.body.data.every((r: any) => r.status === "active")).toBe(true);
        });
    });

    describe("GET /api/restaurants/:id", () => {
        it("returns a restaurant by id", async () => {
            const owner = await createRestaurantOwner({ name: "Solo Place" });
            const res = await request(app).get(`/api/restaurants/${owner.restaurant.id}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.name).toBe("Solo Place");
        });

        it("404s for unknown restaurants", async () => {
            const res = await request(app).get("/api/restaurants/999999");
            expect(res.statusCode).toBe(404);
        });
    });

    describe("PATCH /api/restaurants/:id", () => {
        it("lets the owner update their restaurant", async () => {
            const owner = await createRestaurantOwner({ name: "Rename Me" });
            const res = await request(app)
                .patch(`/api/restaurants/${owner.restaurant.id}`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({ name: "Renamed Co" });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.restaurant.name).toBe("Renamed Co");
        });

        it("denies users from other restaurants", async () => {
            const ownerA = await createRestaurantOwner({ name: "A" });
            const ownerB = await createRestaurantOwner({ name: "B" });
            const res = await request(app)
                .patch(`/api/restaurants/${ownerA.restaurant.id}`)
                .set("Cookie", [`access_token=${ownerB.accessToken}`])
                .send({ name: "Sneaky" });

            expect(res.statusCode).toBe(403);
        });
    });

    describe("PATCH /api/restaurants/:id/status", () => {
        it("lets a system admin suspend a restaurant", async () => {
            const owner = await createRestaurantOwner({ name: "Suspend Me" });
            const res = await request(app)
                .patch(`/api/restaurants/${owner.restaurant.id}/status`)
                .set("Cookie", [`access_token=${systemAdmin.accessToken}`])
                .send({ status: RestaurantStatus.SUSPENDED });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.restaurant.status).toBe(RestaurantStatus.SUSPENDED);

            const outbox = await db("events_outbox").where({ event_type: "restaurant.suspended" }).count("* as n").first();
            expect(Number(outbox?.n ?? 0)).toBe(1);
        });

        it("rejects non-system-admins", async () => {
            const owner = await createRestaurantOwner({ name: "Keep Me" });
            const res = await request(app)
                .patch(`/api/restaurants/${owner.restaurant.id}/status`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({ status: RestaurantStatus.SUSPENDED });

            expect(res.statusCode).toBe(403);
        });
    });

    describe("PATCH /api/restaurants/:id - not found", () => {
        it("404s when the restaurant is missing", async () => {
            const res = await request(app)
                .patch("/api/restaurants/999999")
                .set("Cookie", [`access_token=${systemAdmin.accessToken}`])
                .send({ name: "Ghost" });
            expect(res.statusCode).toBe(404);
        });
    });
});