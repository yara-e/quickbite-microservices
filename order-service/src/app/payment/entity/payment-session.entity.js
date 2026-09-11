"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentSessionEntity = void 0;
class PaymentSessionEntity {
    id;
    region;
    orderId;
    providerId;
    providerSessionId;
    redirectUrl;
    amount;
    currency;
    status;
    rawInitPayload;
    rawLastPayload;
    createdAt;
    updatedAt;
    constructor(data) {
        Object.assign(this, data);
    }
}
exports.PaymentSessionEntity = PaymentSessionEntity;
