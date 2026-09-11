"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAll = startAll;
exports.stopAll = stopAll;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("../logger/logger");
const job_registry_1 = require("./job-registry");
const tasks = [];
/**
 * Boot every registered job. Each handler invocation is wrapped so a thrown
 * error doesn't tear down the cron task — the next tick still runs.
 *
 * Concurrent invocations of the same job are dropped: if a tick is still
 * running when the next fires, that tick is skipped (logged at debug).
 */
function startAll() {
    const running = new Set();
    for (const job of (0, job_registry_1.listJobs)()) {
        if (!node_cron_1.default.validate(job.cron)) {
            throw new Error(`invalid cron expression for job ${job.name}: ${job.cron}`);
        }
        const task = node_cron_1.default.schedule(job.cron, async () => {
            if (running.has(job.name)) {
                logger_1.logger.debug("job skipped (previous tick still running)", { job: job.name });
                return;
            }
            running.add(job.name);
            const start = Date.now();
            try {
                await job.handler();
            }
            catch (err) {
                logger_1.logger.error("job failed", { job: job.name, error: err.message });
            }
            finally {
                running.delete(job.name);
                logger_1.logger.debug("job tick", { job: job.name, ms: Date.now() - start });
            }
        }, { timezone: job.timezone });
        tasks.push(task);
        logger_1.logger.info("job scheduled", { name: job.name, cron: job.cron });
    }
}
/** Stop all scheduled tasks. Called from the worker's SIGINT/SIGTERM handler. */
async function stopAll() {
    for (const t of tasks) {
        try {
            await t.stop();
        }
        catch { }
    }
    tasks.length = 0;
}
