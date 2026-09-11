"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentResponseDTO = exports.PaymentInitResponseDTO = void 0;
const enums_1 = require("../enums");
/**
 * Returned in the `payment` field of OrderResponseDTO when the order's
 * paymentMethod is "online" and Kashier successfully created a session.
 */
class PaymentInitResponseDTO {
    sessionId; // our payment_sessions.id (numeric → string for JSON safety)
    providerSessionId; // Kashier's _id
    redirectUrl;
    amount;
    currency;
    expiresAt; // ISO
    static from(session, expiresAt) {
        const dto = new PaymentInitResponseDTO();
        dto.sessionId = String(session.id);
        dto.providerSessionId = session.providerSessionId;
        dto.redirectUrl = session.redirectUrl;
        dto.amount = session.amount;
        dto.currency = session.currency;
        dto.expiresAt = expiresAt;
        return dto;
    }
}
exports.PaymentInitResponseDTO = PaymentInitResponseDTO;
const PROVIDER_NAME_BY_ID = new Map([
    [enums_1.PAYMENT_PROVIDER_IDS[enums_1.PaymentProviderName.KASHIER], enums_1.PaymentProviderName.KASHIER],
    [enums_1.PAYMENT_PROVIDER_IDS[enums_1.PaymentProviderName.COD], enums_1.PaymentProviderName.COD],
]);
class PaymentResponseDTO {
    id;
    orderId;
    type;
    method;
    provider;
    providerReferenceId;
    status;
    amount;
    currency;
    isRefunded;
    refundedPaymentId;
    createdAt;
    updatedAt;
    static from(tx) {
        const dto = new PaymentResponseDTO();
        dto.id = tx.id;
        dto.orderId = tx.orderId;
        dto.type = tx.transactionType;
        dto.method = tx.method;
        dto.provider = tx.providerId !== null ? PROVIDER_NAME_BY_ID.get(tx.providerId) ?? null : null;
        dto.providerReferenceId = tx.providerReferenceId;
        dto.status = tx.status;
        dto.amount = tx.amount;
        dto.currency = tx.currency;
        dto.isRefunded = tx.isRefunded;
        dto.refundedPaymentId = tx.refundedPaymentId;
        dto.createdAt = tx.createdAt.toISOString();
        dto.updatedAt = tx.updatedAt.toISOString();
        return dto;
    }
}
exports.PaymentResponseDTO = PaymentResponseDTO;
