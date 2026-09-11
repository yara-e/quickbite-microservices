"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drainOutboxForRegion = drainOutboxForRegion;
const knex_1 = require("../knex/knex");
const env_1 = require("../config/env");
const logger_1 = require("../logger/logger");
const init_1 = require("../messaging/init");
const outbox_repo_1 = require("./outbox.repo");
/**
 * One pass over a single region's outbox: claim a batch with FOR UPDATE
 * SKIP LOCKED, publish each row to the order.events exchange, mark dispatched.
 *
 * A publish failure marks the row as failed, bumps attempts, and bails out of
 * the batch (the broker is probably sick — don't hold the lock on the rest).
 *
 * SKIP LOCKED makes this safe to run concurrently across multiple workers in
 * the same region.
 */
async function drainOutboxForRegion(region) {
    const conn = (0, knex_1.db)(region);
    const trx = await conn.transaction();
    try {
        const rows = await (0, outbox_repo_1.claimBatch)(trx, env_1.env.outboundEvents.batchSize);
        if (rows.length === 0) {
            await trx.commit();
            return;
        }
        for (const row of rows) {
            const envelope = {
                eventId: row.event_id,
                eventType: row.event_type,
                occurredAt: new Date().toISOString(),
                aggregateType: row.aggregate_type,
                aggregateId: row.aggregate_id,
                region,
                payload: row.payload,
            };
            try {
                await init_1.messageBroker.publish(env_1.env.outboundEvents.exchange, row.event_type, Buffer.from(JSON.stringify(envelope), "utf8"));
                await (0, outbox_repo_1.markDispatched)(trx, row.id);
            }
            catch (err) {
                const msg = describeError(err);
                await (0, outbox_repo_1.markFailed)(trx, row.id, msg);
                logger_1.logger.error("outbox publish failed", { region, id: row.id, error: msg });
                break;
            }
        }
        await trx.commit();
    }
    catch (err) {
        await trx.rollback();
        throw err;
    }
}
function describeError(err) {
    if (err instanceof Error && err.message)
        return err.message;
    try {
        return JSON.stringify(err);
    }
    catch {
        return String(err);
    }
}
