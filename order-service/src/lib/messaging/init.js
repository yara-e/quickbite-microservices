"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageBroker = void 0;
const rabbitmq_client_1 = require("../../pkg/messaging/rabbitmq/rabbitmq.client");
const env_1 = require("../config/env");
exports.messageBroker = new rabbitmq_client_1.RabbitMQClient({
    url: env_1.env.rabbit.url,
    reconnectInitialMs: 500,
    reconnectMaxMs: 15_000,
});
