import {
    hashPassword,
    comparePassword,
    createAccessToken,
    createRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    generateOTP,
    hashOTP,
} from "../../../src/app/auth/utils";

describe("auth/utils", () => {
    describe("password hashing", () => {
        it("matches the hash produced by the hash password correctly", async () => {
            const password = "StrongPass";
            const hashedPassword = await hashPassword(password);
            expect(hashedPassword).not.toBe(password);
            expect(await comparePassword(password, hashedPassword)).toBe(true);
            expect(await comparePassword("wrongpass", hashedPassword)).toBe(false);
        });
    });

    describe("JWT tokens", () => {
        const payload = { userId: 1, email: "a@b.com", role: "customer" };

        it("creates and verifies an access token", () => {
            const token = createAccessToken(payload);
            const decoded = verifyAccessToken(token);
            expect(decoded.userId).toBe(1);
            expect(decoded.email).toBe("a@b.com");
            expect(decoded.role).toBe("customer");
        });

        it("creates and verifies a refresh token", () => {
            const token = createRefreshToken({ ...payload, restaurantId: 5 });
            const decoded = verifyRefreshToken(token);
            expect(decoded.restaurantId).toBe(5);
        });

        it("round-trips restaurant member fields", () => {
            const full = { userId: 2, email: "r@b.com", role: "restaurant_user", restaurantId: 3, restaurantRole: "owner", branchIds: [1, 2] };
            const decoded = verifyAccessToken(createAccessToken(full));
            expect(decoded.restaurantId).toBe(3);
            expect(decoded.restaurantRole).toBe("owner");
            expect(decoded.branchIds).toEqual([1, 2]);
        });
    });

    describe("OTP helpers", () => {
        it("generates a 6-digit numeric OTP", () => {
            for (let i = 0; i < 20; i++) {
                const otp = generateOTP();
                expect(otp).toMatch(/^\d{6}$/);
            }
        });

        it("hashes OTPs deterministically with sha256", () => {
            const h1 = hashOTP("123456");
            const h2 = hashOTP("123456");
            const h3 = hashOTP("654321");
            expect(h1).toBe(h2);
            expect(h1).toHaveLength(64);
            expect(h1).not.toBe(h3);
        });
    });
});