"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.listJobs = listJobs;
/**
 * Module-level registry of scheduled jobs. Populated at module-load time by
 * `register(...)` calls; consumed by `scheduler.startAll()` at worker boot.
 *
 * Keep registrations side-effect-free at import time — the handler closures
 * resolve their dependencies (DI, env) when CALLED, not when registered.
 */
const jobs = [];
/** Add a job. Names must be unique; a duplicate name is a programmer error. */
function register(job) {
    if (jobs.some((j) => j.name === job.name)) {
        throw new Error(`duplicate scheduled job: ${job.name}`);
    }
    jobs.push(job);
}
/** Snapshot used by the scheduler. */
function listJobs() {
    return jobs;
}
