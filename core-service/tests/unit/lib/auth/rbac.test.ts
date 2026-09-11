import { NextFunction, Request, Response } from "express";
import { rbac, requireRestaurantMember, requireBranchAccess } from "@/lib/auth/rbac";
import { SystemRole } from "@/app/user/enums";

jest.mock("@/lib/di/container", () => ({
    container: { resolve: jest.fn() },
}));

import { container } from "@/lib/di/container";

const resolveMock = container.resolve as jest.Mock;

function jsonRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;
}

describe("rbac", () => {
    beforeEach(() => jest.clearAllMocks());

    it("reports not authenticated when req.user is missing", async () => {
        const next = jest.fn();
        const mw = rbac({ resource: "core:product", action: "create" });
        await mw({} as Request, jsonRes(), next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it("bypasses for system admins when allowSystemAdmin is true (default)", async () => {
        const next = jest.fn();
        const req = { user: { role: SystemRole.SYSTEM_ADMIN } } as unknown as Request;
        const mw = rbac({ resource: "core:product", action: "create" });
        await mw(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(resolveMock).not.toHaveBeenCalled();
    });

    it("does not bypass system admins when allowSystemAdmin is false", async () => {
        const next = jest.fn();
        resolveMock.mockReturnValue({
            getPermissions: jest.fn().mockResolvedValue([]),
            hasPermission: jest.fn().mockReturnValue(false),
        });
        const req = { user: { role: SystemRole.SYSTEM_ADMIN } } as unknown as Request;
        const res = jsonRes();
        const mw = rbac({ resource: "core:product", action: "create", allowSystemAdmin: false });
        await mw(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it("grants a restaurant user who has the permission", async () => {
        const next = jest.fn();
        resolveMock.mockReturnValue({
            getPermissions: jest.fn().mockResolvedValue(["core:product:create"]),
            hasPermission: jest.fn().mockReturnValue(true),
        });
        const req = {
            user: { role: SystemRole.RESTAURANT_USER, restaurantRole: "owner" },
        } as unknown as Request;
        const mw = rbac({ resource: "core:product", action: "create" });
        await mw(req, jsonRes(), next);
        expect(resolveMock).toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("denies a restaurant user without the permission", async () => {
        const next = jest.fn();
        resolveMock.mockReturnValue({
            getPermissions: jest.fn().mockResolvedValue(["core:product:read"]),
            hasPermission: jest.fn().mockReturnValue(false),
        });
        const req = {
            user: { role: SystemRole.RESTAURANT_USER, restaurantRole: "staff" },
        } as unknown as Request;
        const res = jsonRes();
        const mw = rbac({ resource: "core:product", action: "create" });
        await mw(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: "Permission denied" });
        expect(next).not.toHaveBeenCalled();
    });

    it("denies authenticated users that are not restaurant users", async () => {
        const next = jest.fn();
        const req = { user: { role: SystemRole.CUSTOMER } } as unknown as Request;
        const res = jsonRes();
        const mw = rbac({ resource: "core:product", action: "create" });
        await mw(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(resolveMock).not.toHaveBeenCalled();
    });

    it("forwards rejected permission lookups to the error handler", async () => {
        const next = jest.fn();
        resolveMock.mockReturnValue({
            getPermissions: jest.fn().mockRejectedValue(new Error("db down")),
        });
        const req = {
            user: { role: SystemRole.RESTAURANT_USER, restaurantRole: "owner" },
        } as unknown as Request;
        const mw = rbac({ resource: "core:product", action: "create" });
        await mw(req, jsonRes(), next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "db down" }));
    });
});

describe("requireRestaurantMember", () => {
    it("returns 500 when restaurantId param is missing", () => {
        const req = { params: {} } as unknown as Request;
        const res = jsonRes();
        requireRestaurantMember()(req, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "something went wrong" });
    });

    it("lets system admins through", () => {
        const next = jest.fn();
        const req = {
            params: { restaurantId: "10" },
            user: { role: SystemRole.SYSTEM_ADMIN },
        } as unknown as Request;
        requireRestaurantMember()(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("allows a restaurant user whose restaurantId matches", () => {
        const next = jest.fn();
        const req = {
            params: { restaurantId: "10" },
            user: { role: SystemRole.RESTAURANT_USER, restaurantId: 10 },
        } as unknown as Request;
        requireRestaurantMember()(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("denies a restaurant user from a different restaurant", () => {
        const res = jsonRes();
        const req = {
            params: { restaurantId: "20" },
            user: { role: SystemRole.RESTAURANT_USER, restaurantId: 10 },
        } as unknown as Request;
        requireRestaurantMember()(req, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(403);
    });
});

describe("requireBranchAccess", () => {
    it("bypasses system admins", () => {
        const next = jest.fn();
        const req = { user: { role: SystemRole.SYSTEM_ADMIN } } as unknown as Request;
        requireBranchAccess()(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("bypasses owners (full branch access)", () => {
        const next = jest.fn();
        const req = {
            params: { branchId: "5" },
            user: { role: SystemRole.RESTAURANT_USER, restaurantRole: "owner" },
        } as unknown as Request;
        requireBranchAccess()(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("allows when no branch is specified", () => {
        const next = jest.fn();
        const req = {
            params: {},
            query: {},
            user: { role: SystemRole.RESTAURANT_USER, branchIds: [1] },
        } as unknown as Request;
        requireBranchAccess()(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("denies when the branch is not in the user's branchIds", () => {
        const res = jsonRes();
        const req = {
            params: { branchId: "99" },
            query: {},
            user: { role: SystemRole.RESTAURANT_USER, branchIds: [1, 2] },
        } as unknown as Request;
        requireBranchAccess()(req, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: "You do not have access to this branch" });
    });

    it("reads branchId from the query when not in params", () => {
        const next = jest.fn();
        const req = {
            params: {},
            query: { branchId: "3" },
            user: { role: SystemRole.RESTAURANT_USER, branchIds: [3] },
        } as unknown as Request;
        requireBranchAccess()(req, jsonRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});