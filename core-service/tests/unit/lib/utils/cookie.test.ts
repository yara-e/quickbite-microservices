import { Response } from "express";
import { setAuthCookies } from "../../../../src/lib/utils/cookie";

describe("setAuthCookies", () => {
    it("sets both httpOnly cookies with the configured maxAge", () => {
        const res = {
            cookie: jest.fn(),
        } as unknown as Response;

        setAuthCookies(res, "access-token", "refresh-token");

        expect(res.cookie).toHaveBeenCalledWith(
            "access_token",
            "access-token",
            expect.objectContaining({ httpOnly: true, maxAge: 3600 * 1000 })
        );
        expect(res.cookie).toHaveBeenCalledWith(
            "refresh_token",
            "refresh-token",
            expect.objectContaining({ httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, path: "/api/auth/refresh" })
        );
    });
});