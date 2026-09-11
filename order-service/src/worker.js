"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const http_1 = __importDefault(require("http"));
const logger_1 = require("./lib/logger/logger");
const knex_1 = require("./lib/knex/knex");
const init_1 = require("./lib/messaging/init");
const consumer_1 = require("./lib/core-events/consumer");
const ws_server_1 = require("./lib/websocket/ws-server");
const container_1 = require("./lib/di/container");
const tokens_1 = require("./lib/di/tokens");
const scheduler_1 = require("./lib/jobs/scheduler");
const core_events_handlers_1 = require("./app/order/core-events.handlers");
const jobs_1 = require("./app/assignment/jobs");
const jobs_2 = require("./lib/events/jobs");
/**
 * Background worker process. All it does is boot the shared infra and hand
 * control to the cron scheduler. Adding a new background job means: create
 * a `register({...})` call somewhere and import it here. No other wiring.
 */
// Socket.io needs an http.Server to attach to even if we don't listen on a
// real port. Bind to 0 → ephemeral port; the redis adapter does the real
// fan-out so this server never receives an HTTP request.
const noopServer = http_1.default.createServer();
const io = (0, ws_server_1.attachWsServer)(noopServer);
container_1.container.registerInstance(tokens_1.TOKENS.WsServer, io);
// ── Job registrations ───────────────────────────────────────────────────
(0, jobs_1.registerAssignmentJobs)();
(0, jobs_2.registerOutboxDrainJobs)();
// registerOrderArchiveJobs
// (Future jobs land here: payouts sweep, archival, presence GC, etc.)
async function main() {
    noopServer.listen(0);
    const shards = await (0, knex_1.pingAll)();
    for (const r of shards) {
        if (r.ok)
            logger_1.logger.info("worker shard reachable", { region: r.region, cluster: r.cluster });
        else
            logger_1.logger.warn("worker shard unreachable", { region: r.region, cluster: r.cluster, error: r.error });
    }
    (0, core_events_handlers_1.registerOrderModuleCoreEventHandlers)();
    init_1.messageBroker
        .connect()
        .then(() => (0, consumer_1.startCoreEventsConsumer)(init_1.messageBroker))
        .catch((err) => logger_1.logger.warn("worker rabbitmq not reachable at boot", { err }));
    (0, scheduler_1.startAll)();
}
async function shutdown() {
    logger_1.logger.info("worker shutdown requested");
    await (0, scheduler_1.stopAll)();
    try {
        await io.close();
    }
    catch { }
    try {
        await init_1.messageBroker.close();
    }
    catch { }
    try {
        await (0, knex_1.destroyAll)();
    }
    catch { }
    noopServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5_000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
main().catch((err) => {
    logger_1.logger.error("worker boot failed", { error: err.message });
    process.exit(1);
});
