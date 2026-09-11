import "reflect-metadata"
import request from "supertest"
import { emailStub } from "../../helpers/email-stub"
import { truncateAll } from "../../helpers/db"
import { createApp } from "@/app"

jest.mock("../../../src/lib/email/init", () => ({
    emailProvider: emailStub
}))

import { db } from "@/lib/knex/knex"
import { hashPassword, createRefreshToken, hashOTP } from "@/app/auth/utils"

const app = createApp();

const registerBody = {
    email: "chef@test.com",
    phone: "01000000111",
    name: "Chef",
    password: "Str0ng!Pass",
    role: "customer",
};

describe("POST /api/auth/register", () => {
    beforeEach(async () => {
        await truncateAll();
        emailStub.reset();
    });

    it("registers a customer and returns tokens + cookies", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send(registerBody);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.accessToken).toBeTruthy();
        const setCookies = res.headers["set-cookie"] ?? [];
        const hasAccessCookie = Array.isArray(setCookies)
            ? setCookies.some((c: string) => c.startsWith("access_token="))
            : String(setCookies).startsWith("access_token=");
        expect(hasAccessCookie).toBe(true);

        const stored = await db("users").where({ email: registerBody.email }).first();
        expect(stored.system_role).toBe("customer");
    });

    it("rejects signing up as a system admin", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({ ...registerBody, email: "admin@test.com", role: "system_admin" });

        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe("You cannot register as a system admin");
    });

    it("rejects duplicate email/phone", async () => {
        await request(app).post("/api/auth/register").send(registerBody);
        const res = await request(app)
            .post("/api/auth/register")
            .send({ ...registerBody, phone: "01000000222" });

        expect(res.statusCode).toBe(400);
    });

    it("validates the request body", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({ email: "not-an-email" });

        expect(res.statusCode).toBe(400);
    });
});

describe("POST /api/auth/login", () => {
    beforeEach(async () => {
        await truncateAll();
        await db("users").insert({
            email: "customer@test.com",
            phone: "01000000333",
            name: "Customer",
            password_hash: await hashPassword("Str0ng!Pass"),
            system_role: "customer",
            created_at: new Date(),
            updated_at: new Date(),
        });
    });

    it("logs in and returns tokens + cookies", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "customer@test.com", password: "Str0ng!Pass" });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.message).toBe("Login successful");
        expect(res.body.data.accessToken).toBeTruthy();
        expect(res.body.data.refreshToken).toBeTruthy();
        expect(res.body.data.user.id).toBeTruthy();
    });

    it("rejects a wrong password", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "customer@test.com", password: "WrongPass" });

        expect(res.statusCode).toBe(401);
    });

    it("rejects unknown emails", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "ghost@test.com", password: "Str0ng!Pass" });

        expect(res.statusCode).toBe(401);
    });
});

describe("POST /api/auth/refresh", () => {
    beforeEach(async () => {
        await truncateAll();
    });

    it("issues a fresh access token cookie from a valid refresh token", async () => {
        const ids = await db("users").insert({
            email: "r@test.com",
            phone: "01000000444",
            name: "R",
            password_hash: await hashPassword("Str0ng!Pass"),
            system_role: "customer",
            created_at: new Date(),
            updated_at: new Date(),
        }).returning("id");

        const refreshToken = createRefreshToken({
            userId: Number(ids[0].id),
            email: "r@test.com",
            role: "customer",
        });

        const res = await request(app)
            .post("/api/auth/refresh")
            .set("Cookie", [`refresh_token=${refreshToken}`]);

        expect(res.statusCode).toBe(200);
        const cookies = res.headers["set-cookie"] ?? [];
        expect(Array.isArray(cookies) ? cookies.some((c: string) => c.startsWith("access_token=")) : String(cookies).startsWith("access_token=")).toBe(true);
    });

    it("rejects when no refresh token cookie is set", async () => {
        const res = await request(app).post("/api/auth/refresh");
        expect(res.statusCode).toBe(401);
    });
});

describe("POST /api/auth/forget-password + reset-password", () => {
    beforeEach(async () => {
        await truncateAll();
        emailStub.reset();
    });

    it("persists a reset row and emails the user", async () => {
        const now = new Date();
        await db("users").insert({
            email: "test@test.com",
            phone: "01000000001",
            name: "user",
            password_hash: await hashPassword("Str0ng!Pass"),
            system_role: "customer",
            created_at: now,
            updated_at: now,
        });

        const res = await request(app)
            .post("/api/auth/forget-password")
            .set("Idempotency-key", "k-unique-forget-1")
            .send({ email: "test@test.com" });

        expect(res.statusCode).toBe(200);
        expect(await db("password_resets").count("* as n").first()).toEqual({ n: "1" });
        expect(emailStub.sent[0].to).toBe("test@test.com");
    });

    it("does not reveal whether an email exists", async () => {
        const res = await request(app)
            .post("/api/auth/forget-password")
            .set("Idempotency-key", "k-unique-forget-2")
            .send({ email: "missing@test.com" });

        expect(res.statusCode).toBe(200);
        expect(emailStub.sent).toHaveLength(0);
    });

    it("resets the password with the OTP", async () => {
        await db("users").insert({
            email: "reset@test.com",
            phone: "01000000555",
            name: "Reset",
            password_hash: await hashPassword("OldPass1!"),
            system_role: "customer",
            created_at: new Date(),
            updated_at: new Date(),
        });
        const oldHash = await db("users").where({ email: "reset@test.com" }).first();
        const user = await db("users").where({ email: "reset@test.com" }).first();
        await db("password_resets").insert({
            user_id: user.id,
            otp_hash: hashOTP("123456"),
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
            created_at: new Date(),
        });

        const res = await request(app)
            .post("/api/auth/reset-password")
            .send({ email: "reset@test.com", otp: "123456", newPassword: "NewStr0ng1!Pass" });

        expect(res.statusCode).toBe(200);
        const updated = await db("users").where({ email: "reset@test.com" }).first();
        expect(updated.password_hash).not.toBe(oldHash.password_hash);
        // oldest (non-consumed) reset is now consumed
        const reset = await db("password_resets").where({ user_id: user.id }).first();
        expect(reset.consumed_at).not.toBeNull();
    });

    it("rejects an invalid OTP", async () => {
        await db("users").insert({
            email: "reset2@test.com",
            phone: "01000000666",
            name: "Reset2",
            password_hash: await hashPassword("Str0ng!Pass"),
            system_role: "customer",
            created_at: new Date(),
            updated_at: new Date(),
        });
        const user = await db("users").where({ email: "reset2@test.com" }).first();
        await db("password_resets").insert({
            user_id: user.id,
            otp_hash: hashOTP("111111"),
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
            created_at: new Date(),
        });

        const res = await request(app)
            .post("/api/auth/reset-password")
            .send({ email: "reset2@test.com", otp: "999999", newPassword: "NewStr0ng1!Pass" });

        expect(res.statusCode).toBe(401);
    });
});