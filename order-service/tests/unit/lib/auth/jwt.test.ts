import jwt from "jsonwebtoken";
import {verifyAccessToken, verifyRefreshToken} from "@/lib/auth/jwt";
import {NotAuthenticated} from "@/lib/auth/errors";

describe("lib/auth/jwt", () => {
    const payload = {
        userId: 1,
        role: "customer",
        email: "a@b.com",
    };
    let accessToken: string;
    let refreshToken: string;

    beforeAll(() => {
        accessToken = jwt.sign(payload, "test-access-secret");
        refreshToken = jwt.sign({...payload, restaurantId: 5}, "test-refresh-secret");
    });

    it("verifies an access token", () => {
        const decoded = verifyAccessToken(accessToken);
        expect(decoded.userId).toBe(1);
        expect(decoded.email).toBe("a@b.com");
    });

    it("verifies a refresh token and keeps restaurantId", () => {
        const decoded = verifyRefreshToken(refreshToken);
        expect(decoded.restaurantId).toBe(5);
    });

    it("throws NotAuthenticated on an invalid token", () => {
        expect(() => verifyAccessToken("garbage")).toThrow(NotAuthenticated);
        expect(() => verifyAccessToken(jwt.sign(payload, "wrong-secret"))).toThrow(NotAuthenticated);
    });
});