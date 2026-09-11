"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_SESSION_COLUMNS = void 0;
exports.createSession = createSession;
exports.findSessionByProviderId = findSessionByProviderId;
exports.findActiveSessionByOrderId = findActiveSessionByOrderId;
exports.updateSession = updateSession;
const payment_session_entity_1 = require("../entity/payment-session.entity");
const enums_1 = require("../enums");
exports.PAYMENT_SESSION_COLUMNS = [
    "id",
    "region",
    "order_id",
    "provider_id",
    "provider_session_id",
    "redirect_url",
    "amount",
    "currency",
    "status",
    "raw_init_payload",
    "raw_last_payload",
    "created_at",
    "updated_at",
];
function toEntity(row) {
    return new payment_session_entity_1.PaymentSessionEntity({
        id: Number(row.id),
        region: row.region,
        orderId: Number(row.order_id),
        providerId: Number(row.provider_id),
        providerSessionId: row.provider_session_id,
        redirectUrl: row.redirect_url,
        amount: Number(row.amount),
        currency: row.currency,
        status: row.status,
        rawInitPayload: row.raw_init_payload,
        rawLastPayload: row.raw_last_payload,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}
async function createSession(input, conn) {
    const [row] = await conn("payment_sessions")
        .insert({
        region: input.region,
        order_id: input.orderId,
        provider_id: input.providerId,
        provider_session_id: input.providerSessionId,
        redirect_url: input.redirectUrl,
        amount: input.amount,
        currency: input.currency,
        status: input.status,
        raw_init_payload: JSON.stringify(input.rawInitPayload),
    })
        .returning(exports.PAYMENT_SESSION_COLUMNS);
    return toEntity(row);
}
async function findSessionByProviderId(providerSessionId, conn) {
    const row = await conn("payment_sessions")
        .select(exports.PAYMENT_SESSION_COLUMNS)
        .where({ provider_session_id: providerSessionId })
        .first();
    return row ? toEntity(row) : undefined;
}
async function findActiveSessionByOrderId(orderId, conn) {
    const row = await conn("payment_sessions")
        .select(exports.PAYMENT_SESSION_COLUMNS)
        .where("order_id", orderId)
        .whereIn("status", [enums_1.PaymentSessionStatus.INITIALIZED, enums_1.PaymentSessionStatus.PENDING])
        .orderBy("id", "desc")
        .first();
    return row ? toEntity(row) : undefined;
}
async function updateSession(id, input, conn) {
    const update = {
        status: input.status,
        updated_at: conn.fn.now(),
    };
    if (input.rawLastPayload !== undefined) {
        update.raw_last_payload = JSON.stringify(input.rawLastPayload);
    }
    const [row] = await conn("payment_sessions")
        .where({ id })
        .update(update)
        .returning(exports.PAYMENT_SESSION_COLUMNS);
    return toEntity(row);
}
