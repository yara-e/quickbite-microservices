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

const app = createApp();

describe("Product endpoints", () => {
    beforeEach(async () => {
        await truncateAll();
    });

    const seedRestaurant = async () => {
        const owner = await createRestaurantOwner({ name: "Product Place" });
        const branch = await createBranch(owner.restaurant.id, { label: "Branch One" });
        const product = await createProduct(owner.restaurant.id, "Burger");
        await db("product_branch_details").where({ branch_id: branch.id, product_id: product.id }).update({
            price: 150,
            stock: 10,
            is_available: true,
        });
        return { owner, branch, product };
    };

    it("GET /api/restaurants/:id/categories returns categories", async () => {
        const owner = await createRestaurantOwner({ name: "Cats Place" });
        await db("product_categories").insert({
            restaurant_id: owner.restaurant.id,
            name: "Mains",
            created_at: new Date(),
            updated_at: new Date(),
        });

        const res = await request(app).get(`/api/restaurants/${owner.restaurant.id}/categories`);
        expect(res.statusCode).toBe(200);
        expect(res.body.data.some((c: any) => c.name === "Mains")).toBe(true);
    });

    it("GET /api/branches/:branchId/products returns branch products", async () => {
        const { branch, product } = await seedRestaurant();
        const res = await request(app).get(`/api/branches/${branch.id}/products`);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).toMatchObject({ id: product.id, name: "Burger", price: 150, stock: 10, isAvailable: true });
    });

    it("GET /api/products/:id returns a product", async () => {
        const { product } = await seedRestaurant();
        const res = await request(app).get(`/api/products/${product.id}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.data.name).toBe("Burger");
    });

    it("GET /api/products/:id 404s for unknown products", async () => {
        const res = await request(app).get("/api/products/999999");
        expect(res.statusCode).toBe(404);
    });
 
    describe("authenticated product routes", () => {
        it("POST /api/restaurants/:id/products lets the owner create a product", async () => {
            const { owner } = await seedRestaurant();
            const res = await request(app)
                .post(`/api/restaurants/${owner.restaurant.id}/products`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({ name: "Pizza", description: "Hot", categoryName: "Mains" });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.product.name).toBe("Pizza");
        });

        it("GET /api/restaurants/:id/products lets the owner list products", async () => {
            const { owner, product } = await seedRestaurant();
            const res = await request(app)
                .get(`/api/restaurants/${owner.restaurant.id}/products`)
                .set("Cookie", [`access_token=${owner.accessToken}`]);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.some((p: any) => p.id === product.id)).toBe(true);
        });

        it("denies a staff member from creating a product (RBAC read-only)", async () => {
            const { owner, branch } = await seedRestaurant();
            const staff = await createRestaurantMemberUser(owner.restaurant.id, "staff", [branch.id]);

            const res = await request(app)
                .post(`/api/restaurants/${owner.restaurant.id}/products`)
                .set("Cookie", [`access_token=${staff.accessToken}`])
                .send({ name: "Steal" });

            expect(res.statusCode).toBe(403);
        });

        it("PATCH /api/products/:id?branchId= updates branch details + prices", async () => {
            const { owner, branch, product } = await seedRestaurant();

            const res = await request(app)
                .patch(`/api/products/${product.id}?branchId=${branch.id}`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({ name: "Burger XL", price: 200, stock: 7, isAvailable: true });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.product.name).toBe("Burger XL");
            expect(res.body.data.branchDetails).toMatchObject({ price: 200, stock: 7, isAvailable: true });

            const priceEvents = await db("events_outbox").where({ event_type: "product.price.changed" }).count("* as n").first();
            expect(Number(priceEvents?.n ?? 0)).toBe(1);
            const stockEvents = await db("events_outbox").where({ event_type: "product.stock.changed" }).count("* as n").first();
            expect(Number(stockEvents?.n ?? 0)).toBe(1);
        });
    });

    describe("internal stock endpoints", () => {
        it("GET /api/internal/branches/:id/products?ids= returns products by ids", async () => {
            const { branch, product } = await seedRestaurant();
            const res = await request(app)
                .get(`/api/internal/branches/${branch.id}/products?ids=${product.id}`)
                .set("api-key", "test-internal-api-key");

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0]).toMatchObject({ productId: product.id, price: 150, stock: 10 });
        });

        it("POST /api/internal/branches/:id/reserve-stock decrements stock atomically", async () => {
            const { branch, product } = await seedRestaurant();

            const res = await request(app)
                .post(`/api/internal/branches/${branch.id}/reserve-stock`)
                .set("api-key", "test-internal-api-key")
                .send({ items: [{ productId: product.id, quantity: 4 }] });

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toMatchObject({ ok: true, applied: [{ productId: Number(product.id), newStock: 6 }] });

            const row = await db("product_branch_details").where({ branch_id: branch.id, product_id: product.id }).first();
            expect(Number(row.stock)).toBe(6);
        });

        it("reserve-stock rejects when quantity exceeds stock", async () => {
            const { branch, product } = await seedRestaurant();
            const res = await request(app)
                .post(`/api/internal/branches/${branch.id}/reserve-stock`)
                .set("api-key", "test-internal-api-key")
                .send({ items: [{ productId: product.id, quantity: 100 }] });

            expect(res.statusCode).toBe(409);
        });

        it("POST /api/internal/branches/:id/release-stock increments stock back", async () => {
            const { branch, product } = await seedRestaurant();

            const res = await request(app)
                .post(`/api/internal/branches/${branch.id}/release-stock`)
                .set("api-key", "test-internal-api-key")
                .send({ items: [{ productId: product.id, quantity: 2 }] });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.applied).toEqual([{ productId: Number(product.id), newStock: 12 }]);
        });
    });
});