"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAssignmentJobs = registerAssignmentJobs;
const job_registry_1 = require("../../lib/jobs/job-registry");
const container_1 = require("../../lib/di/container");
const tokens_1 = require("../../lib/di/tokens");
const env_1 = require("../../lib/config/env");
const logger_1 = require("../../lib/logger/logger");
/**
 * Registers one assignment-tick job per configured region. Each fires every
 * ASSIGNMENT_TICK_SEC seconds — translated to a 6-field cron expression
 * (`*\/N * * * * *`). Per-region jobs let one region's slow tick not block
 * another's.
 *
 * Idempotent: safe to call once per process boot.
 */
function registerAssignmentJobs() {
    const everyNSec = `*/${env_1.env.delivery.assignmentTickSec} * * * * *`;
    for (const region of env_1.env.regions) {
        (0, job_registry_1.register)({
            name: `assignment-tick:${region}`,
            cron: everyNSec,
            handler: async () => {
                const assignmentService = container_1.container.resolve(tokens_1.TOKENS.AssignmentService);
                const result = await assignmentService.tickRegion(region);
                if (result.processed > 0) {
                    logger_1.logger.info("assignment.tick", { region, ...result });
                }
            },
        });
    }
}
