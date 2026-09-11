"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = void 0;
require("reflect-metadata");
const tsyringe_1 = require("tsyringe");
Object.defineProperty(exports, "container", { enumerable: true, get: function () { return tsyringe_1.container; } });
const tokens_1 = require("./tokens");
const logger_1 = require("../logger/logger");
const init_1 = require("../cache/init");
const init_2 = require("../messaging/init");
const core_client_1 = require("../core-client/core-client");
const permission_cache_service_1 = require("../rbac/permission-cache.service");
const core_data_cache_service_1 = require("../../app/order/service/core-data-cache.service");
const order_service_1 = require("../../app/order/service/order.service");
const order_controller_1 = require("../../app/order/controller/order.controller");
const env_1 = require("../config/env");
const kashier_client_1 = require("../../pkg/payments/kashier/kashier.client");
const payment_service_1 = require("../../app/payment/service/payment.service");
const kashier_webhook_service_1 = require("../../app/payment/service/kashier-webhook.service");
const payment_controller_1 = require("../../app/payment/controller/payment.controller");
const webhook_controller_1 = require("../../app/payment/controller/webhook.controller");
const presence_service_1 = require("../../app/agent/service/presence.service");
const settlement_service_1 = require("../../app/agent/service/settlement.service");
const agent_service_1 = require("../../app/agent/service/agent.service");
const agent_controller_1 = require("../../app/agent/controller/agent.controller");
const assignment_service_1 = require("../../app/assignment/service/assignment.service");
const assignment_controller_1 = require("../../app/assignment/controller/assignment.controller");
const finance_service_1 = require("../../app/finance/service/finance.service");
const finance_controller_1 = require("../../app/finance/controller/finance.controller");
// Infrastructure
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.Logger, logger_1.Logger);
tsyringe_1.container.registerInstance(tokens_1.TOKENS.CacheProvider, init_1.cacheProvider);
tsyringe_1.container.registerInstance(tokens_1.TOKENS.MessageBroker, init_2.messageBroker);
tsyringe_1.container.registerInstance(tokens_1.TOKENS.CoreClient, core_client_1.coreClient);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.PermissionCacheService, permission_cache_service_1.PermissionCacheService);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.CoreDataCacheService, core_data_cache_service_1.CoreDataCacheService);
// pkg providers (constructed eagerly with env config)
const kashierClient = new kashier_client_1.KashierClient({
    baseUrl: env_1.env.kashier.baseUrl,
    merchantId: env_1.env.kashier.merchantId,
    apiKey: env_1.env.kashier.apiKey,
    secretKey: env_1.env.kashier.secretKey,
    paymentType: env_1.env.kashier.paymentType,
    serverWebhookUrl: env_1.env.kashier.webhookUrl,
    merchantRedirect: env_1.env.kashier.returnUrl,
    failureRedirectEnabled: false,
    sessionTimeoutSec: env_1.env.payments.sessionTimeoutMin * 60,
});
tsyringe_1.container.registerInstance(tokens_1.TOKENS.KashierProvider, kashierClient);
// Domain: order
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.OrderService, order_service_1.OrderService);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.OrderController, order_controller_1.OrderController);
// Domain: payment
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.PaymentService, payment_service_1.PaymentService);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.KashierWebhookService, kashier_webhook_service_1.KashierWebhookService);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.PaymentController, payment_controller_1.PaymentController);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.WebhookController, webhook_controller_1.WebhookController);
// Domain: agent + assignment + settlement (Phase 3)
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.PresenceService, presence_service_1.PresenceService);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.AssignmentService, assignment_service_1.AssignmentService);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.SettlementService, settlement_service_1.SettlementService);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.AgentService, agent_service_1.AgentService);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.AgentController, agent_controller_1.AgentController);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.AssignmentController, assignment_controller_1.AssignmentController);
// Domain: finance (Phase 4)
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.FinanceService, finance_service_1.FinanceService);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.FinanceController, finance_controller_1.FinanceController);
