"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandler = registerHandler;
exports.listRegisteredHandlers = listRegisteredHandlers;
exports.startCoreEventsConsumer = startCoreEventsConsumer;
const env_1 = require("../config/env");
const logger_1 = require("../logger/logger");
const init_1 = require("../cache/init");
// Safety window for redelivery (consumer restart, nack-requeue, ops DLQ replay).
// Longer than realistic redelivery lag, short enough to keep Redis bounded.
// Safe to expire: all handlers are idempotent cache invalidations.
const DEDUPE_TTL_SEC = 24 * 60 * 60;
const handlers = new Map();
function registerHandler(eventType, handler) {
    if (handlers.has(eventType)) {
        throw new Error(`Handler already registered for ${eventType}`);
    }
    handlers.set(eventType, handler);
}
function listRegisteredHandlers() {
    return Array.from(handlers.keys());
}
const topology = {
    exchange: env_1.env.rabbit.exchange,
    queue: env_1.env.rabbit.queue,
    bindingKeys: env_1.env.rabbit.bindings,
    deadLetterExchange: env_1.env.rabbit.dlx,
    deadLetterQueue: env_1.env.rabbit.dlq,
    prefetch: env_1.env.rabbit.prefetch,
};
async function startCoreEventsConsumer(broker) {
    await broker.declareTopology(topology);
    await broker.consume(topology, handleMessage);
    logger_1.logger.info("core-events consumer started", {
        queue: env_1.env.rabbit.queue,
        bindings: env_1.env.rabbit.bindings,
    });
}
async function handleMessage(msg) {
    const envelope = parseEnvelope(msg);
    if (!envelope)
        return msg.nack(false);
    // Dedupe via Redis SETNX. Returns false if we've already processed this eventId.
    const fresh = await init_1.cacheProvider.trySet(`core-events:dedupe:${envelope.eventId}`, "1", DEDUPE_TTL_SEC);
    if (!fresh) {
        msg.ack();
        return;
    }
    const handler = handlers.get(envelope.eventType);
    if (!handler) {
        logger_1.logger.warn("core-events: no handler, acking", {
            eventType: envelope.eventType,
            eventId: envelope.eventId,
        });
        msg.ack();
        return;
    }
    try {
        await handler(envelope.payload);
        msg.ack();
    }
    catch (err) {
        logger_1.logger.error("core-events: handler failed, sending to DLQ", {
            eventType: envelope.eventType,
            eventId: envelope.eventId,
            error: err.message,
        });
        msg.nack(false);
    }
}
function parseEnvelope(msg) {
    try {
        const env = JSON.parse(msg.body.toString("utf8"));
        if (!env.eventId || !env.eventType)
            return null;
        return env;
    }
    catch {
        return null;
    }
}
