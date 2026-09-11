"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreDataCacheService = void 0;
const tsyringe_1 = require("tsyringe");
const tokens_1 = require("../../../lib/di/tokens");
const logger_1 = require("../../../lib/logger/logger");
const time_1 = require("../../../pkg/utils/time");
/**
 * Owns the order-service projection of core data cached in Redis.
 *
 * Responsibilities:
 *   - Cache writes / invalidations driven by inbound core-events.
 *   - Reject-orders flag for branches that go offline (read on placement).
 *
 * Read-throughs live in `lib/core-client/branch.client.ts` (`getBranch`,
 * `getBranchesByIds`, `getBranchProducts`) — they share the same Redis keys
 * this service writes to (`core:branch:<id>`, `core:branch:<bid>:product:<pid>`),
 * so an inbound event invalidates / merges the read-through cache entry too.
 */
const PRODUCT_CACHE_TTL = (0, time_1.toSeconds)(1, "h");
const BRANCH_REJECT_FLAG_TTL = (0, time_1.toSeconds)(7, "d");
function productKey(branchId, productId) {
    return `core:branch:${branchId}:product:${productId}`;
}
function branchKey(branchId) {
    return `core:branch:${branchId}`;
}
function restaurantKey(restaurantId) {
    return `core:restaurant:${restaurantId}`;
}
function rejectFlagKey(branchId) {
    return `branch:reject-new-orders:${branchId}`;
}
let CoreDataCacheService = class CoreDataCacheService {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    isBranchRejectingOrders = async (branchId) => {
        const flag = await this.cache.get(rejectFlagKey(branchId));
        return flag === "1";
    };
    handleProductStockChanged = async (payload) => {
        const p = payload;
        if (!p?.branchId || !p?.productId)
            return;
        await this.upsertProductStock(p);
    };
    handleProductPriceChanged = async (payload) => {
        const p = payload;
        if (!p?.branchId || !p?.productId)
            return;
        await this.upsertProductPrice(p);
    };
    handleBranchUpdated = async (payload) => {
        const p = payload;
        if (!p?.branchId)
            return;
        await this.cache.del(branchKey(p.branchId));
        await this.cache.del(rejectFlagKey(p.branchId));
        logger_1.logger.debug("branch.updated -> invalidated", { branchId: p.branchId });
    };
    handleBranchDeactivated = async (payload) => {
        const p = payload;
        if (!p?.branchId)
            return;
        await this.cache.del(branchKey(p.branchId));
        await this.cache.set(rejectFlagKey(p.branchId), "1", BRANCH_REJECT_FLAG_TTL);
        logger_1.logger.info("branch.deactivated -> reject-new-orders flag set", { branchId: p.branchId });
    };
    handleRestaurantSuspended = async (payload) => {
        const p = payload;
        if (!p?.restaurantId)
            return;
        await this.cache.del(restaurantKey(p.restaurantId));
        logger_1.logger.info("restaurant.suspended -> cache invalidated", { restaurantId: p.restaurantId });
    };
    upsertProductStock = async (p) => {
        const existing = await this.cache.get(productKey(p.branchId, p.productId));
        const merged = existing ? JSON.parse(existing) : {};
        if (p.newStock !== undefined)
            merged.stock = p.newStock;
        if (p.isAvailable !== undefined)
            merged.isAvailable = p.isAvailable;
        merged.productId = p.productId;
        await this.cache.set(productKey(p.branchId, p.productId), JSON.stringify(merged), PRODUCT_CACHE_TTL);
        logger_1.logger.debug("product.stock.changed -> upserted", { branchId: p.branchId, productId: p.productId, newStock: p.newStock });
    };
    upsertProductPrice = async (p) => {
        const existing = await this.cache.get(productKey(p.branchId, p.productId));
        const merged = existing ? JSON.parse(existing) : {};
        merged.price = p.newPrice;
        merged.productId = p.productId;
        await this.cache.set(productKey(p.branchId, p.productId), JSON.stringify(merged), PRODUCT_CACHE_TTL);
        logger_1.logger.debug("product.price.changed -> upserted", { branchId: p.branchId, productId: p.productId, newPrice: p.newPrice });
    };
};
exports.CoreDataCacheService = CoreDataCacheService;
exports.CoreDataCacheService = CoreDataCacheService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.CacheProvider)),
    __metadata("design:paramtypes", [Object])
], CoreDataCacheService);
