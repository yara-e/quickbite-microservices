"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentRouter = void 0;
const express_1 = require("express");
const guard_1 = require("../../lib/auth/guard");
const rbac_1 = require("../../lib/auth/rbac");
const region_resolver_1 = require("../../lib/sharding/region-resolver");
const idempotency_1 = require("../../lib/idempotency/idempotency");
const container_1 = require("../../lib/di/container");
const tokens_1 = require("../../lib/di/tokens");
exports.assignmentRouter = (0, express_1.Router)();
const ctrl = container_1.container.resolve(tokens_1.TOKENS.AssignmentController);
// Admin override — force-assigns regardless of distance / busy state.
// rbac{deliveries:assign} or system_admin (admin always bypasses).
exports.assignmentRouter.post("/admin/orders/:publicId/assign", guard_1.authenticate, region_resolver_1.requireRegion, (0, rbac_1.rbac)({ resource: "deliveries", action: "assign" }), (0, idempotency_1.idempotency)({ strict: true }), ctrl.adminAssign);
