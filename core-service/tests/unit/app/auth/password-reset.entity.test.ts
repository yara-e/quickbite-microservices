import { PasswordReset } from "@/app/auth/entity/password-reset.entity";

describe("PasswordReset entity", () => {
    it("defaults consumedAt to null", () => {
        const reset = new PasswordReset({
            id: 1,
            userId: 1,
            otpHash: "abc",
            expiresAt: new Date(),
            createdAt: new Date(),
        });
        expect(reset.consumedAt).toBeNull();
    });

    it("isExpired returns true for past expiry", () => {
        const reset = new PasswordReset({
            id: 1,
            userId: 1,
            otpHash: "abc",
            expiresAt: new Date(Date.now() - 1000),
            createdAt: new Date(),
        });
        expect(reset.isExpired()).toBe(true);
    });

    it("isExpired returns false for a future expiry", () => {
        const reset = new PasswordReset({
            id: 1,
            userId: 1,
            otpHash: "abc",
            expiresAt: new Date(Date.now() + 60_000),
            createdAt: new Date(),
        });
        expect(reset.isExpired()).toBe(false);
    });
});