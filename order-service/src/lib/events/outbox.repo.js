"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertOutboxEvent = insertOutboxEvent;
exports.insertOutboxEvents = insertOutboxEvents;
exports.claimBatch = claimBatch;
exports.markDispatched = markDispatched;
exports.markFailed = markFailed;
const crypto_1 = require("crypto");
/**
 * Insert an event in the SAME trx as the domain mutation that produced it.
 * Caller passes their region-bound Knex (or trx). Dispatch happens later via
 * the drainer — this function does not touch RabbitMQ.
 */
async function insertOutboxEvent(conn, input) {
    await conn("events_outbox").insert({
        aggregate_type: input.aggregateType,
        aggregate_id: String(input.aggregateId),
        event_type: input.eventType,
        event_id: (0, crypto_1.randomUUID)(),
        payload: JSON.stringify(input.payload),
    });
}
/**
 * Bulk variant — single INSERT with N rows. Use whenever a service mutates
 * multiple aggregates in one trx so we don't pay N round-trips to Postgres.
 */
async function insertOutboxEvents(conn, inputs) {
    if (inputs.length === 0)
        return;
    await conn("events_outbox").insert(inputs.map((i) => ({
        aggregate_type: i.aggregateType,
        aggregate_id: String(i.aggregateId),
        event_type: i.eventType,
        event_id: (0, crypto_1.randomUUID)(),
        payload: JSON.stringify(i.payload),
    })));
}
/**
 * Dispatcher claim — selects a batch of undispatched rows and locks them so
 * another drainer process won't pick up the same rows. Caller is responsible
 * for committing/rolling back the trx.
 */
async function claimBatch(conn, limit) {
    const rows = await conn("events_outbox")
        .select("id", "aggregate_type", "aggregate_id", "event_type", "event_id", "payload", "attempts")
        .whereNull("dispatched_at")
        .orderBy("id", "asc")
        .limit(limit)
        .forUpdate()
        .skipLocked();
    return rows;
}
async function markDispatched(conn, id) {
    await conn("events_outbox").where({ id }).update({ dispatched_at: new Date() });
}
async function markFailed(conn, id, err) {
    await conn("events_outbox")
        .where({ id })
        .update({
        attempts: conn.raw("attempts + 1"),
        last_error: err.slice(0, 2000),
    });
}
