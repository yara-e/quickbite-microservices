"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentWebhookEventEntity = void 0;
class PaymentWebhookEventEntity {
    id;
    region;
    providerId;
    providerEventId;
    signature;
    payload;
    receivedAt;
    processedAt;
    processError;
    constructor(data) {
        Object.assign(this, data);
    }
}
exports.PaymentWebhookEventEntity = PaymentWebhookEventEntity;
