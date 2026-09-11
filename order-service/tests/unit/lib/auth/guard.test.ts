import {NextFunction, Request, Response} from "express";
import jwt from "jsonwebtoken";
import {authenticate} from "@/lib/auth/guard";
import {NotAuthenticated} from "@/lib/auth/errors";

describe("lib/auth/guard", () => {
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        res = {};
        next = jest.fn();
    });

    it("throws NotAuthenticated when no access token cookie is present", () => {
        const req = {cookies: {}} as unknown as Request;
        expect(() => authenticate(req, res as Response, next)).toThrow(NotAuthenticated);
        expect(next).not.toHaveBeenCalled();
    });

    it("verifies the token and calls next on a valid cookie", () => {
        const token = jwt.sign(
            {userId: 7, role: "customer", email: "a@b.com"},
            "test-access-secret",
        );
        const req = {cookies: {access_token: token}} as unknown as Request;
        authenticate(req, res as Response, next);
        expect((req as any).user).toMatchObject({userId: 7, role: "customer"});
        expect(next).toHaveBeenCalledTimes(1);
    });
});