"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOrderModuleCoreEventHandlers = registerOrderModuleCoreEventHandlers;
const container_1 = require("../../lib/di/container");
const tokens_1 = require("../../lib/di/tokens");
const consumer_1 = require("../../lib/core-events/consumer");
/**
 * Thin wrappers — each handler delegates to a service method that owns the
 * full action (cache update, side-effects, downstream HTTP, etc.). The
 * consumer registry stays a clean event-type → service-method table.
 */
function registerOrderModuleCoreEventHandlers() {
    const coreData = container_1.container.resolve(tokens_1.TOKENS.CoreDataCacheService);
    const perms = container_1.container.resolve(tokens_1.TOKENS.PermissionCacheService);
    (0, consumer_1.registerHandler)("product.stock.changed", coreData.handleProductStockChanged);
    (0, consumer_1.registerHandler)("product.price.changed", coreData.handleProductPriceChanged);
    (0, consumer_1.registerHandler)("branch.updated", coreData.handleBranchUpdated);
    (0, consumer_1.registerHandler)("branch.deactivated", coreData.handleBranchDeactivated);
    (0, consumer_1.registerHandler)("restaurant.suspended", coreData.handleRestaurantSuspended);
    (0, consumer_1.registerHandler)("rbac.permissions_changed", perms.handlePermissionsChanged);
}
