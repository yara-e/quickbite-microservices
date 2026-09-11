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
import { AddressType } from "@/app/customer-address/enums"

const app = createApp();

describe("Customer address endpoints", () => {
    let customer: Awaited<ReturnType<typeof createUser>>;
    const addressBody = {
        label: "Home",
        country: "EG",
        city: "Cairo",
        street: "Main St 1",
        building: "Tower A",
        apartmentNumber: "12",
        type: AddressType.HOME,
        lat: 30.0444,
        lng: 31.2357,
        isDefault: false,
    };

    beforeEach(async () => {
        await truncateAll();
        customer = await createUser({ systemRole: SystemRole.CUSTOMER });
    });

    function auth(token: string) {
        return { Cookie: [`access_token=${token}`] };
    }

    it("creates, lists, updates, and deletes addresses for the user", async () => {
        // create
        const createRes = await request(app)
            .post("/api/customer/addresses")
            .set(auth(customer.accessToken))
            .send(addressBody);
        expect(createRes.statusCode).toBe(201);
        expect(createRes.body.data.address.label).toBe("Home");
        const addrId = createRes.body.data.address.id;

        // list
        const listRes = await request(app)
            .get("/api/customer/addresses")
            .set(auth(customer.accessToken));
        expect(listRes.statusCode).toBe(200);
        expect(listRes.body.data).toHaveLength(1);

        // update
        const updateRes = await request(app)
            .patch(`/api/customer/addresses/${addrId}`)
            .set(auth(customer.accessToken))
            .send({ label: "Work", isDefault: true });
        expect(updateRes.statusCode).toBe(200);
        expect(updateRes.body.data.address.label).toBe("Work");
        expect(updateRes.body.data.address.isDefault).toBe(true);

        // internal getById
        const internalRes = await request(app)
            .get(`/api/customer/addresses/internal/${addrId}`)
            .set("api-key", "test-internal-api-key");
        expect(internalRes.statusCode).toBe(200);
        expect(internalRes.body.data.id).toBe(addrId);

        // delete
        const delRes = await request(app)
            .delete(`/api/customer/addresses/${addrId}`)
            .set(auth(customer.accessToken));
        expect(delRes.statusCode).toBe(200);
        expect(await db("customer_addresses").count("* as n").first()).toEqual({ n: "0" });
    });

    it("enforces that a user cannot touch another user's address", async () => {
        const other = await createUser({ systemRole: SystemRole.CUSTOMER });

        const createRes = await request(app)
            .post("/api/customer/addresses")
            .set(auth(customer.accessToken))
            .send(addressBody);
        const addrId = createRes.body.data.address.id;

        const updateRes = await request(app)
            .patch(`/api/customer/addresses/${addrId}`)
            .set(auth(other.accessToken))
            .send({ label: "Hacked" });

        expect(updateRes.statusCode).toBe(404);

        const delRes = await request(app)
            .delete(`/api/customer/addresses/${addrId}`)
            .set(auth(other.accessToken));
        expect(delRes.statusCode).toBe(404);
    });

    it("requires authentication", async () => {
        const res = await request(app).post("/api/customer/addresses").send(addressBody);
        expect(res.statusCode).toBe(401);
    });

    it("validates the payload", async () => {
        const res = await request(app)
            .post("/api/customer/addresses")
            .set(auth(customer.accessToken))
            .send({ label: "Home" });
        expect(res.statusCode).toBe(400);
    });
});