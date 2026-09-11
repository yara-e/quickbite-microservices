"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRouter = void 0;
const express_1 = require("express");
const guard_1 = require("../../lib/auth/guard");
const rbac_1 = require("../../lib/auth/rbac");
const idempotency_1 = require("../../lib/idempotency/idempotency");
const withCache_1 = require("../../lib/cache/withCache");
const region_resolver_1 = require("../../lib/sharding/region-resolver");
const container_1 = require("../../lib/di/container");
const tokens_1 = require("../../lib/di/tokens");
exports.orderRouter = (0, express_1.Router)();
const orderController = container_1.container.resolve(tokens_1.TOKENS.OrderController);
// ── Customer-facing ─────────────────────────────────────────────────────
exports.orderRouter.post("/orders", guard_1.authenticate, region_resolver_1.requireRegion, (0, idempotency_1.idempotency)({ strict: true }), orderController.placeOrder);
exports.orderRouter.get("/orders/:publicId", guard_1.authenticate, region_resolver_1.requireRegion, orderController.getOrder);
exports.orderRouter.get("/customer/orders", guard_1.authenticate, region_resolver_1.requireRegion, orderController.listCustomerOrders);
// Customer-only cancel endpoint (status target is implicit: cancelled).
exports.orderRouter.patch("/customer/orders/:publicId/status", guard_1.authenticate, region_resolver_1.requireRegion, (0, idempotency_1.idempotency)({ strict: true }), orderController.updateStatus);
// ── Restaurant-facing (path-scoped so middleware can guard) ─────────────
exports.orderRouter.get("/restaurants/:restaurantId/branches/:branchId/orders", guard_1.authenticate, region_resolver_1.requireRegion, (0, rbac_1.requireRestaurantMember)("restaurantId"), (0, rbac_1.requireBranchAccess)("branchId"), (0, rbac_1.rbac)({ resource: "orders", action: "read" }), (0, withCache_1.withCache)(10), orderController.listRestaurantOrders);
// Restaurant member status transitions (accept/reject/preparing/ready/cancelled).
// The status machine + the rbac() middleware enforce per-target permissions.
exports.orderRouter.patch("/restaurants/:restaurantId/branches/:branchId/orders/:publicId/status", guard_1.authenticate, region_resolver_1.requireRegion, (0, rbac_1.requireRestaurantMember)("restaurantId"), (0, rbac_1.requireBranchAccess)("branchId"), (0, idempotency_1.idempotency)({ strict: true }), orderController.updateStatus);
// ── Admin override (any transition the matrix allows for `admin`) ───────
exports.orderRouter.patch("/admin/orders/:publicId/status", guard_1.authenticate, region_resolver_1.requireRegion, (0, rbac_1.rbac)({ resource: "orders", action: "cancel" }), (0, idempotency_1.idempotency)({ strict: true }), orderController.updateStatus);
