"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
/**
 * Raw inbound webhook log for audit + replay. Unique on (provider_id,
 * provider_event_id) gives at-most-once processing semantics: a duplicate
 * INSERT … ON CONFLICT DO NOTHING returns 0 rows and we ack the request 200.
 */
async function up(knex) {
    await knex.raw(`
        CREATE TABLE payment_webhook_events (
            id                BIGSERIAL PRIMARY KEY,
            region            TEXT NOT NULL,
            provider_id       INT NOT NULL,
            provider_event_id TEXT NOT NULL,
            signature         TEXT NOT NULL,
            payload           JSONB NOT NULL,
            received_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            processed_at      TIMESTAMP NULL,
            process_error     TEXT NULL,

            CONSTRAINT uq_payment_webhook_events_provider_event_id UNIQUE (provider_id, provider_event_id)
        );
    `);
}
async function down(knex) {
    await knex.raw(`DROP TABLE IF EXISTS payment_webhook_events`);
}
