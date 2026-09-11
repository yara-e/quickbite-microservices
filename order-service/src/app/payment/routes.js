"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = void 0;
const express_1 = require("express");
const guard_1 = require("../../lib/auth/guard");
const rbac_1 = require("../../lib/auth/rbac");
const region_resolver_1 = require("../../lib/sharding/region-resolver");
const container_1 = require("../../lib/di/container");
const tokens_1 = require("../../lib/di/tokens");
exports.paymentRouter = (0, express_1.Router)();
const paymentController = container_1.container.resolve(tokens_1.TOKENS.PaymentController);
const webhookController = container_1.container.resolve(tokens_1.TOKENS.WebhookController);
// Public webhook — verified by HMAC inside the controller; no auth middleware.
// Region comes from `?region=eg` (Kashier can't set custom headers).
exports.paymentRouter.post("/payments/webhook/kashier", region_resolver_1.requireConcreteRegion, webhookController.kashier);
// Restaurant-scoped read. requireRestaurantMember + rbac handle the auth;
// the service only verifies the payment actually belongs to this restaurant.
exports.paymentRouter.get("/restaurants/:restaurantId/payments/:paymentId", guard_1.authenticate, region_resolver_1.requireConcreteRegion, (0, rbac_1.requireRestaurantMember)("restaurantId"), (0, rbac_1.rbac)({ resource: "payments", action: "read" }), paymentController.getById);
