"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOutboxDrainJobs = registerOutboxDrainJobs;
const job_registry_1 = require("../jobs/job-registry");
const env_1 = require("../config/env");
const logger_1 = require("../logger/logger");
const init_1 = require("../messaging/init");
const outbox_drain_1 = require("./outbox-drain");
/**
 * Registers one outbox-drain job per region. Each fires every
 * OUTBOUND_EVENTS_DRAIN_TICK_SEC seconds. Per-region jobs prevent one slow
 * region from blocking another's events.
 *
 * Also asserts the outbound exchange exists (idempotent).
 */
function registerOutboxDrainJobs() {
    const everyNSec = `*/${env_1.env.outboundEvents.drainTickSec} * * * * *`;
    init_1.messageBroker
        .connect()
        .then(() => init_1.messageBroker.declareTopology({
        exchange: env_1.env.outboundEvents.exchange,
        queue: "__outbox-drain-noop__",
        bindingKeys: [],
        prefetch: 1,
    }).catch((err) => logger_1.logger.warn("outbound exchange declare failed (will retry on first publish)", {
        error: err.message,
    })))
        .catch(() => { });
    for (const region of env_1.env.regions) {
        (0, job_registry_1.register)({
            name: `outbox-drain:${region}`,
            cron: everyNSec,
            handler: async () => {
                try {
                    await (0, outbox_drain_1.drainOutboxForRegion)(region);
                }
                catch (err) {
                    logger_1.logger.error("outbox-drain failed", { region, error: err.message });
                }
            },
        });
    }
}
