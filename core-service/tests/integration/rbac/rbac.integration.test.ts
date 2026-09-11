import "reflect-metadata"
import request from "supertest"
import { truncateAll } from "../../helpers/db"
import { emailStub } from "../../helpers/email-stub"
import { createUser, createRestaurantOwner, createRestaurantMemberUser, createBranch } from "../../helpers/seed"
import { createApp } from "@/app"

jest.mock("../../../src/lib/email/init", () => ({
    emailProvider: emailStub,
}))

import { db } from "@/lib/knex/knex"
import { SystemRole } from "@/app/user/enums"
import { MemberStatus } from "@/app/rbac/enums"

const app = createApp();

describe("RBAC endpoints", () => {
    beforeEach(async () => {
        await truncateAll();
        emailStub.reset();
    });

    it("GET /api/roles/:role/permissions is public and returns the catalog", async () => {
        const res = await request(app).get("/api/roles/staff/permissions");

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.data.permissions)).toBe(true);
        const perms: string[] = res.body.data.permissions.map((p: any) => p.permission);
        expect(perms).toContain("core:product:read");
        expect(perms).toContain("core:member:read");
        expect(perms).not.toContain("core:product:create");
    });

    it("GET /api/internal/rbac/permissions?role= returns raw permission keys", async () => {
        const res = await request(app)
            .get("/api/internal/rbac/permissions?role=owner")
            .set("api-key", "test-internal-api-key");

        expect(res.statusCode).toBe(200);
        const perms: string[] = res.body.data.permissions;
        expect(perms).toContain("core:product:create");
        expect(perms).toContain("orders:read");
        expect(perms).toContain("finance:payout_create");
    });

    it("GET /api/internal/rbac/permissions without role returns 400", async () => {
        const res = await request(app)
            .get("/api/internal/rbac/permissions")
            .set("api-key", "test-internal-api-key");
        expect(res.statusCode).toBe(400);
    });

    describe("member management", () => {
        it("owner creates a member, they receive an invitation email, and list includes them", async () => {
            const owner = await createRestaurantOwner({ name: "Team Root" });

            const createRes = await request(app)
                .post(`/api/restaurants/${owner.restaurant.id}/members`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({
                    email: "newbie@test.com",
                    name: "Newbie",
                    phoneNumber: "01012345678",
                    role: "staff",
                    branchIds: [],
                });

            expect(createRes.statusCode).toBe(201);
            expect(createRes.body.data.message).toBe("Member invited successfully");
            expect(createRes.body.data.member.role).toBe("staff");
            expect(createRes.body.data.member.status).toBe(MemberStatus.INACTIVE);

            expect(emailStub.sent.some((e) => e.to === "newbie@test.com")).toBe(true);
            const memberUser = await db("users").where({ email: "newbie@test.com" }).first();
            const reset = await db("password_resets").where({ user_id: memberUser.id }).count("* as n").first();
            expect(Number(reset?.n ?? 0)).toBe(1);

            const listRes = await request(app)
                .get(`/api/restaurants/${owner.restaurant.id}/members`)
                .set("Cookie", [`access_token=${owner.accessToken}`]);
            expect(listRes.statusCode).toBe(200);
            expect(listRes.body.data.data.some((m: any) => m.email === "newbie@test.com")).toBe(true);
        });

        it("rejects creating another owner", async () => {
            const owner = await createRestaurantOwner({ name: "Single Owner" });
            const res = await request(app)
                .post(`/api/restaurants/${owner.restaurant.id}/members`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({
                    email: "boss2@test.com",
                    name: "Second Boss",
                    phoneNumber: "01087654321",
                    role: "owner",
                    branchIds: [],
                });

            expect(res.statusCode).toBe(400);
        });
    });

    it("lets the owner update and delete a member", async () => {
            const owner = await createRestaurantOwner({ name: "Manage Team" });
            await db("users").insert({
                email: "susan@test.com",
                phone: "01033334444",
                name: "Susan",
                password_hash: "x",
                system_role: SystemRole.RESTAURANT_USER,
                created_at: new Date(),
                updated_at: new Date(),
            });
            const member = await db("users").where({ email: "susan@test.com" }).first();
            const staffRole = await db("roles").where({ name: "staff" }).first();
            const now = new Date();
            const [memberRow] = await db("restaurant_members").insert({
                restaurant_id: owner.restaurant.id,
                user_id: member.id,
                role_id: staffRole.id,
                status: MemberStatus.ACTIVE,
                created_at: now,
                updated_at: now,
            }).returning("*");

            const updateRes = await request(app)
                .patch(`/api/restaurants/${owner.restaurant.id}/members/${memberRow.id}`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({ role: "branch_manager", status: "suspended" });
            expect(updateRes.statusCode).toBe(200);

            const refreshed = await db("restaurant_members").where({ id: memberRow.id }).first();
            const managerRole = await db("roles").where({ name: "branch_manager" }).first();
            expect(refreshed.status).toBe("suspended");
            expect(Number(refreshed.role_id)).toBe(Number(managerRole.id));

            const delRes = await request(app)
                .delete(`/api/restaurants/${owner.restaurant.id}/members/${memberRow.id}`)
                .set("Cookie", [`access_token=${owner.accessToken}`]);
            expect(delRes.statusCode).toBe(200);
            expect(await db("restaurant_members").where({ id: memberRow.id }).count("* as n").first()).toEqual({ n: "0" });
        });

        it("cannot delete the restaurant owner", async () => {
            const owner = await createRestaurantOwner({ name: "Protected Owner" });
            const res = await request(app)
                .delete(`/api/restaurants/${owner.restaurant.id}/members/${owner.member.id}`)
                .set("Cookie", [`access_token=${owner.accessToken}`]);

            expect(res.statusCode).toBe(400);
        });

    describe("member branch assignment", () => {
        it("PUT /api/restaurants/:rid/members/:mid/branches assigns branches", async () => {
            const owner = await createRestaurantOwner({ name: "Branches Co" });
            const branch = await createBranch(owner.restaurant.id, { label: "Main Branch" });
            const staff = await createRestaurantMemberUser(owner.restaurant.id, "staff", []);

            const res = await request(app)
                .put(`/api/restaurants/${owner.restaurant.id}/members/${staff.member.id}/branches`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({ branchIds: [Number(branch.id)] });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.branchIds).toEqual([Number(branch.id)]);

            const rows = await db("member_branches").where({ member_id: staff.member.id });
            expect(rows.map((r) => Number(r.branch_id))).toEqual([Number(branch.id)]);
        });

        it("refuses assigning branches to the owner", async () => {
            const owner = await createRestaurantOwner({ name: "No Branches For Owners" });
            const branch = await createBranch(owner.restaurant.id);

            const res = await request(app)
                .put(`/api/restaurants/${owner.restaurant.id}/members/${owner.member.id}/branches`)
                .set("Cookie", [`access_token=${owner.accessToken}`])
                .send({ branchIds: [Number(branch.id)] });

            expect(res.statusCode).toBe(400);
        });
    });

    it("staff cannot create members (RBAC read-only)", async () => {
        const owner = await createRestaurantOwner({ name: "Read Only Rest" });
        const staff = await createRestaurantMemberUser(owner.restaurant.id, "staff", []);

        const res = await request(app)
            .post(`/api/restaurants/${owner.restaurant.id}/members`)
            .set("Cookie", [`access_token=${staff.accessToken}`])
            .send({
                email: "nope@test.com",
                name: "Nope",
                phoneNumber: "01099998888",
                role: "staff",
                branchIds: [],
            });

        expect(res.statusCode).toBe(403);
    });
});