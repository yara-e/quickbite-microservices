"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRouter = void 0;
const express_1 = require("express");
const guard_1 = require("../../lib/auth/guard");
const rbac_1 = require("../../lib/auth/rbac");
const region_resolver_1 = require("../../lib/sharding/region-resolver");
const idempotency_1 = require("../../lib/idempotency/idempotency");
const container_1 = require("../../lib/di/container");
const tokens_1 = require("../../lib/di/tokens");
exports.agentRouter = (0, express_1.Router)();
const ctrl = container_1.container.resolve(tokens_1.TOKENS.AgentController);
// Presence — online + ping share the same UPSERT handler; offline is its own
// thing because it has the "can't go offline while picked" rule.
exports.agentRouter.post("/agents/presence/online", guard_1.authenticate, rbac_1.requireAgent, region_resolver_1.requireRegion, ctrl.presenceUpsert);
exports.agentRouter.post("/agents/presence/ping", guard_1.authenticate, rbac_1.requireAgent, region_resolver_1.requireRegion, ctrl.presenceUpsert);
exports.agentRouter.post("/agents/presence/offline", guard_1.authenticate, rbac_1.requireAgent, region_resolver_1.requireRegion, ctrl.offline);
// Offers
exports.agentRouter.post("/agents/orders/:publicId/accept", guard_1.authenticate, rbac_1.requireAgent, region_resolver_1.requireRegion, (0, idempotency_1.idempotency)({ strict: true }), ctrl.accept);
exports.agentRouter.post("/agents/orders/:publicId/reject", guard_1.authenticate, rbac_1.requireAgent, region_resolver_1.requireRegion, ctrl.reject);
// In-flight transitions (picked / delivered)
exports.agentRouter.patch("/agents/orders/:publicId/status", guard_1.authenticate, rbac_1.requireAgent, region_resolver_1.requireRegion, (0, idempotency_1.idempotency)({ strict: true }), ctrl.transition);
// Reads
exports.agentRouter.get("/agents/tasks", guard_1.authenticate, rbac_1.requireAgent, region_resolver_1.requireRegion, ctrl.tasks);
exports.agentRouter.get("/agents/earnings", guard_1.authenticate, rbac_1.requireAgent, region_resolver_1.requireRegion, ctrl.earnings);
