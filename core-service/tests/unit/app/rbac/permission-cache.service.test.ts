import { PermissionCacheService } from "@/app/rbac/service/permission-cache.service";

jest.mock("@/app/rbac/repository/permission.repo", () => ({
    getPermissionsByRoleName: jest.fn(),
}));

import { getPermissionsByRoleName } from "@/app/rbac/repository/permission.repo";

const getPermissionsMock = getPermissionsByRoleName as jest.Mock;

describe("PermissionCacheService", () => {
    let service: PermissionCacheService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new PermissionCacheService();
    });

    it("fetches permissions from the repo on a cold cache and caches them", async () => {
        getPermissionsMock.mockResolvedValue(["core:product:create", "core:product:read"]);

        const perms = await service.getPermissions("owner");

        expect(getPermissionsMock).toHaveBeenCalledWith("owner");
        expect(perms).toEqual(["core:product:create", "core:product:read"]);

        // second call hits the in-memory cache
        getPermissionsMock.mockClear();
        const again = await service.getPermissions("owner");
        expect(again).toEqual(["core:product:create", "core:product:read"]);
        expect(getPermissionsMock).not.toHaveBeenCalled();
    });

    it("re-fetches after the TTL expires", async () => {
        getPermissionsMock.mockResolvedValue(["core:product:read"]);

        await service.getPermissions("staff");
        // force expiry
        (service as any).cache.get("staff").cachedAt = Date.now() - 2 * 60 * 60 * 1000;

        await service.getPermissions("staff");
        expect(getPermissionsMock).toHaveBeenCalledTimes(2);
    });

    it("hasPermission checks the resource:action composite", () => {
        const perms = ["core:product:create", "core:member:read"];
        expect(service.hasPermission(perms, "core:product", "create")).toBe(true);
        expect(service.hasPermission(perms, "core:product", "update")).toBe(false);
        expect(service.hasPermission(perms, "orders", "read")).toBe(false);
    });
});