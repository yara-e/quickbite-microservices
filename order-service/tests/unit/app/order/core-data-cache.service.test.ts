import {CoreDataCacheService} from "@/app/order/service/core-data-cache.service";

jest.mock("@/lib/logger/logger", () => ({
    logger: {info: jest.fn(), debug: jest.fn()},
}));

describe("app/order/core-data-cache.service", () => {
    let cache: any;
    let service: CoreDataCacheService;

    beforeEach(() => {
        process.env.TZ = "UTC";
        cache = {
            get: jest.fn(),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(1),
        };
        service = new CoreDataCacheService(cache);
    });

    it("isBranchRejectingOrders returns false when flag missing", async () => {
        cache.get.mockResolvedValue(null);
        await expect(service.isBranchRejectingOrders(5)).resolves.toBe(false);
    });

    it("isBranchRejectingOrders returns true when flag is '1'", async () => {
        cache.get.mockResolvedValue("1");
        await expect(service.isBranchRejectingOrders(5)).resolves.toBe(true);
    });

    it("handleProductStockChanged upserts stock into the product cache key", async () => {
        cache.get.mockResolvedValue(null);
        await service.handleProductStockChanged({branchId: 5, productId: 9, newStock: 4});

        expect(cache.set).toHaveBeenCalledWith(
            "core:branch:5:product:9",
            JSON.stringify({stock: 4, productId: 9}),
            expect.any(Number),
        );
    });

    it("handleProductStockChanged merges with an existing entry", async () => {
        cache.get.mockResolvedValue(JSON.stringify({price: 150, productId: 9}));
        await service.handleProductStockChanged({branchId: 5, productId: 9, newStock: 4, isAvailable: true});

        const [key, value] = cache.set.mock.calls[0] as [string, string, number];
        expect(key).toBe("core:branch:5:product:9");
        expect(JSON.parse(value)).toEqual({price: 150, productId: 9, stock: 4, isAvailable: true});
    });

    it("handleProductStockChanged ignores malformed payloads", async () => {
        await service.handleProductStockChanged({});
        expect(cache.set).not.toHaveBeenCalled();
    });

    it("handleProductPriceChanged sets the price", async () => {
        cache.get.mockResolvedValue(null);
        await service.handleProductPriceChanged({branchId: 2, productId: 7, newPrice: 300});
        expect(cache.set).toHaveBeenCalledWith(
            "core:branch:2:product:7",
            JSON.stringify({price: 300, productId: 7}),
            expect.any(Number),
        );
    });

    it("handleBranchUpdated invalidates branch + flag keys", async () => {
        await service.handleBranchUpdated({branchId: 4});
        expect(cache.del).toHaveBeenCalledWith("core:branch:4");
        expect(cache.del).toHaveBeenCalledWith("branch:reject-new-orders:4");
    });

    it("handleBranchDeactivated sets the reject flag", async () => {
        await service.handleBranchDeactivated({branchId: 4});
        expect(cache.set).toHaveBeenCalledWith("branch:reject-new-orders:4", "1", expect.any(Number));
        expect(cache.del).toHaveBeenCalledWith("core:branch:4");
    });

    it("handleRestaurantSuspended invalidates the restaurant key", async () => {
        await service.handleRestaurantSuspended({restaurantId: 22});
        expect(cache.del).toHaveBeenCalledWith("core:restaurant:22");
    });
});