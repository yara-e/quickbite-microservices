"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeRouter = void 0;
const express_1 = require("express");
const guard_1 = require("../../lib/auth/guard");
const rbac_1 = require("../../lib/auth/rbac");
const region_resolver_1 = require("../../lib/sharding/region-resolver");
const idempotency_1 = require("../../lib/idempotency/idempotency");
const container_1 = require("../../lib/di/container");
const tokens_1 = require("../../lib/di/tokens");
exports.financeRouter = (0, express_1.Router)();
const ctrl = container_1.container.resolve(tokens_1.TOKENS.FinanceController);
// Restaurant-scoped reads. requireRestaurantMember pins :restaurantId to the
// JWT's restaurantId; system_admin bypasses.
exports.financeRouter.get("/restaurants/:restaurantId/balance", guard_1.authenticate, region_resolver_1.requireRegion, (0, rbac_1.requireRestaurantMember)("restaurantId"), (0, rbac_1.rbac)({ resource: "finance", action: "read" }), ctrl.getBalance);
exports.financeRouter.get("/restaurants/:restaurantId/payouts", guard_1.authenticate, region_resolver_1.requireRegion, (0, rbac_1.requireRestaurantMember)("restaurantId"), (0, rbac_1.rbac)({ resource: "finance", action: "read" }), ctrl.listPayouts);
// Admin-only write. requireRestaurantMember would block non-admins anyway, but
// rbac covers admin bypass + future operator role.
exports.financeRouter.post("/admin/restaurants/:restaurantId/payouts", guard_1.authenticate, region_resolver_1.requireRegion, (0, rbac_1.rbac)({ resource: "finance", action: "payout_create" }), (0, idempotency_1.idempotency)({ strict: true }), ctrl.createPayout);
