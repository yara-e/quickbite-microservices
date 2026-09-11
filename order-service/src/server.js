"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const env_1 = require("./lib/config/env");
const logger_1 = require("./lib/logger/logger");
const knex_1 = require("./lib/knex/knex");
const init_1 = require("./lib/messaging/init");
const consumer_1 = require("./lib/core-events/consumer");
const ws_server_1 = require("./lib/websocket/ws-server");
const container_1 = require("./lib/di/container");
const tokens_1 = require("./lib/di/tokens");
const core_events_handlers_1 = require("./app/order/core-events.handlers");
const app = (0, app_1.createApp)();
const server = http_1.default.createServer(app);
const io = (0, ws_server_1.attachWsServer)(server);
container_1.container.registerInstance(tokens_1.TOKENS.WsServer, io);
server.listen(env_1.env.port, async () => {
    logger_1.logger.info(`order-service listening on :${env_1.env.port}`);
    // shard ping at boot (non-fatal; logs per shard)
    try {
        const result = await (0, knex_1.pingAll)();
        for (const r of result) {
            if (r.ok)
                logger_1.logger.info("shard reachable", { region: r.region, cluster: r.cluster });
            else
                logger_1.logger.warn("shard unreachable", { region: r.region, cluster: r.cluster, error: r.error });
        }
    }
    catch (err) {
        logger_1.logger.error("shard ping failed", { error: err.message });
    }
    (0, core_events_handlers_1.registerOrderModuleCoreEventHandlers)();
    init_1.messageBroker
        .connect()
        .then(() => (0, consumer_1.startCoreEventsConsumer)(init_1.messageBroker))
        .catch((err) => {
        logger_1.logger.warn("rabbitmq not reachable at boot — will retry", { err });
    });
});
async function shutdown() {
    logger_1.logger.info("shutdown requested");
    server.close(async () => {
        try {
            await io.close();
        }
        catch { }
        try {
            await init_1.messageBroker.close();
        }
        catch (err) {
            logger_1.logger.warn("broker close error", { error: err.message });
        }
        try {
            await (0, knex_1.destroyAll)();
        }
        catch (err) {
            logger_1.logger.warn("db destroy error", { error: err.message });
        }
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
