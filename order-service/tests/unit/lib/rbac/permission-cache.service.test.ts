import {PermissionCacheService} from "@/lib/rbac/permission-cache.service";

jest.mock("@/lib/core-client/rbac.client", () => ({
    getPermissionsByRole: jest.fn(),
}));

jest.mock("@/lib/logger/logger", () => ({
    logger: {info: jest.fn()},
}));

import {getPermissionsByRole} from "@/lib/core-client/rbac.client";

const getMock = getPermissionsByRole as jest.Mock;

describe("lib/rbac/permission-cache.service", () => {
    let service: PermissionCacheService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new PermissionCacheService();
    });

    it("fetches from the client on a cold cache and caches", async () => {
        getMock.mockResolvedValue(["orders:read"]);
        const perms = await service.getPermissions("owner");
        expect(perms).toEqual(["orders:read"]);
        expect(getMock).toHaveBeenCalledTimes(1);

        getMock.mockClear();
        await service.getPermissions("owner");
        expect(getMock).not.toHaveBeenCalled();
    });

    it("re-fetches after the TTL expires", async () => {
        getMock.mockResolvedValue(["orders:read"]);
        await service.getPermissions("staff");
        (service as any).cache.get("staff").cachedAt = Date.now() - 2 * 60 * 60 * 1000;
        await service.getPermissions("staff");
        expect(getMock).toHaveBeenCalledTimes(2);
    });

    it("hasPermission checks the composite resource:action", () => {
        const perms = ["orders:read", "orders:accept"];
        expect(service.hasPermission(perms, "orders", "read")).toBe(true);
        expect(service.hasPermission(perms, "orders", "cancel")).toBe(false);
    });

    it("invalidate clears one role or all", async () => {
        getMock.mockResolvedValue(["a:read"]);
        await service.getPermissions("owner");
        await service.getPermissions("staff");

        service.invalidate("owner");
        expect((service as any).cache.has("owner")).toBe(false);
        expect((service as any).cache.has("staff")).toBe(true);

        service.invalidate();
        expect((service as any).cache.size).toBe(0);
    });

    it("handlePermissionsChanged invalidates the relevant role", async () => {
        getMock.mockResolvedValue(["a:read"]);
        await service.getPermissions("owner");
        await service.handlePermissionsChanged({role: "owner"});
        expect((service as any).cache.has("owner")).toBe(false);
    });
});