import {NextFunction, Request, Response} from "express";
import {requireAgent, rbac, requireRestaurantMember, requireBranchAccess} from "@/lib/auth/rbac";
import {NotAuthenticated} from "@/lib/auth/errors";

jest.mock("@/lib/di/container", () => ({
    container: {resolve: jest.fn()},
}));

import {container} from "@/lib/di/container";

const resolveMock = container.resolve as jest.Mock;

function jsonRes() {
    return {status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis()} as any;
}

describe("lib/auth/rbac requireAgent", () => {
    it("returns 401 when unauthenticated", () => {
        const res = jsonRes();
        requireAgent({} as Request, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 for non-agents", () => {
        const req = {user: {role: "customer"}} as unknown as Request;
        const res = jsonRes();
        requireAgent(req, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({error: "Agent role required"});
    });

    it("passes delivery agents through", () => {
        const next = jest.fn();
        const req = {user: {role: "delivery_agent"}} as unknown as Request;
        requireAgent(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});

describe("lib/auth/rbac rbac()", () => {
    beforeEach(() => jest.clearAllMocks());

    it("throws NotAuthenticated when req.user is missing", async () => {
        const next = jest.fn();
        const mw = rbac({resource: "orders", action: "read"});
        await mw({} as Request, jsonRes(), next);
        expect(next).toHaveBeenCalledWith(NotAuthenticated);
    });

    it("bypasses system admins by default", async () => {
        const next = jest.fn();
        const req = {user: {role: "system_admin"}} as unknown as Request;
        const mw = rbac({resource: "orders", action: "read"});
        await mw(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(resolveMock).not.toHaveBeenCalled();
    });

    it("checks permissions for restaurant users via the cache service", async () => {
        resolveMock.mockReturnValue({
            getPermissions: jest.fn().mockResolvedValue(["orders:read"]),
            hasPermission: jest.fn().mockReturnValue(true),
        });
        const next = jest.fn();
        const req = {
            user: {role: "restaurant_user", restaurantRole: "owner"},
        } as unknown as Request;
        const mw = rbac({resource: "orders", action: "read"});
        await mw(req, jsonRes(), next);
        expect(resolveMock).toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("denies restaurant users without the permission", async () => {
        resolveMock.mockReturnValue({
            getPermissions: jest.fn().mockResolvedValue([]),
            hasPermission: jest.fn().mockReturnValue(false),
        });
        const req = {
            user: {role: "restaurant_user", restantRole: "staff"},
        } as unknown as Request;
        const res = jsonRes();
        const mw = rbac({resource: "orders", action: "cancel"});
        await mw(req, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(403);
    });
});

describe("lib/auth/rbac requireRestaurantMember", () => {
    it("returns 400 when param missing", () => {
        const res = jsonRes();
        requireRestaurantMember()({params: {}} as unknown as Request, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it("lets system admins through", () => {
        const next = jest.fn();
        const req = {params: {restaurantId: "10"}, user: {role: "system_admin"}} as unknown as Request;
        requireRestaurantMember()(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("matches the user's restaurantId", () => {
        const next = jest.fn();
        const req = {
            params: {restaurantId: "10"},
            user: {role: "restaurant_user", restaurantId: 10},
        } as unknown as Request;
        requireRestaurantMember()(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("denies a mismatched restaurant", () => {
        const res = jsonRes();
        const req = {
            params: {restaurantId: "20"},
            user: {role: "restaurant_user", restaurantId: 10},
        } as unknown as Request;
        requireRestaurantMember()(req, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(403);
    });
});

describe("lib/auth/rbac requireBranchAccess", () => {
    it("bypasses admins", () => {
        const next = jest.fn();
        const req = {user: {role: "system_admin"}} as unknown as Request;
        requireBranchAccess()(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("bypasses owners", () => {
        const next = jest.fn();
        const req = {
            params: {branchId: "5"},
            user: {role: "restaurant_user", restaurantRole: "owner"},
        } as unknown as Request;
        requireBranchAccess()(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("denies a branch not in the user's list", () => {
        const res = jsonRes();
        const req = {
            params: {branchId: "99"},
            query: {},
            user: {role: "restaurant_user", branchIds: [1, 2]},
        } as unknown as Request;
        requireBranchAccess()(req, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(403);
    });
});