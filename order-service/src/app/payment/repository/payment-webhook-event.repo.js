"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEBHOOK_EVENT_COLUMNS = void 0;
exports.recordWebhookOrSkip = recordWebhookOrSkip;
exports.markWebhookProcessed = markWebhookProcessed;
const payment_webhook_event_entity_1 = require("../entity/payment-webhook-event.entity");
exports.WEBHOOK_EVENT_COLUMNS = [
    "id",
    "region",
    "provider_id",
    "provider_event_id",
    "signature",
    "payload",
    "received_at",
    "processed_at",
    "process_error",
];
function toEntity(row) {
    return new payment_webhook_event_entity_1.PaymentWebhookEventEntity({
        id: Number(row.id),
        region: row.region,
        providerId: Number(row.provider_id),
        providerEventId: row.provider_event_id,
        signature: row.signature,
        payload: row.payload,
        receivedAt: row.received_at,
        processedAt: row.processed_at,
        processError: row.process_error,
    });
}
/**
 * Returns the inserted row, or `undefined` if a row with the same
 * (provider_id, provider_event_id) already exists. Caller MUST treat
 * `undefined` as "duplicate, ack the webhook with 200 and skip processing".
 */
async function recordWebhookOrSkip(input, conn) {
    const rows = await conn("payment_webhook_events")
        .insert({
        region: input.region,
        provider_id: input.providerId,
        provider_event_id: input.providerEventId,
        signature: input.signature,
        payload: JSON.stringify(input.payload),
    })
        .onConflict(["provider_id", "provider_event_id"])
        .ignore()
        .returning(exports.WEBHOOK_EVENT_COLUMNS);
    if (rows.length === 0)
        return undefined;
    return toEntity(rows[0]);
}
async function markWebhookProcessed(id, error, conn) {
    await conn("payment_webhook_events")
        .where({ id })
        .update({
        processed_at: conn.fn.now(),
        process_error: error,
    });
}
