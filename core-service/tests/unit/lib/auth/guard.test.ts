import { NextFunction, Request, Response } from "express";
import { authenticate } from "../../../../src/lib/auth/guard";
import { NotAuthenticated } from "../../../../src/lib/auth/errors";

jest.mock("@/app/auth/utils", () => ({
    verifyAccessToken: jest.fn(),
}));

import { verifyAccessToken } from "../../../../src/app/auth/utils";

describe("authenticate", () => {
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();
        res = {};
        next = jest.fn();
    });

    it("throws NotAuthenticated when no access token cookie is present", () => {
        const req = { cookies: {} } as unknown as Request;

        expect(() => authenticate(req, res as Response, next)).toThrow(NotAuthenticated);
        expect(verifyAccessToken).not.toHaveBeenCalled();
    });

    it("verifies the token, attaches req.user and calls next", () => {
        const payload = { userId: 7, email: "a@b.com", role: "system_admin" };
        (verifyAccessToken as jest.Mock).mockReturnValue(payload);

        const req = { cookies: { access_token: "jwt" } } as unknown as Request;

        authenticate(req, res as Response, next);

        expect(verifyAccessToken).toHaveBeenCalledWith("jwt");
        expect(req.user).toEqual(payload);
        expect(next).toHaveBeenCalledTimes(1);
    });
});