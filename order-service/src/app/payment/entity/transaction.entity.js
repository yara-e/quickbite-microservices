"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionEntity = void 0;
class TransactionEntity {
    id;
    region;
    orderId;
    transactionType;
    method;
    providerId;
    providerReferenceId;
    status;
    amount;
    currency;
    srcAccId;
    dstAccId;
    isRefunded;
    refundedPaymentId;
    idempotencyKey;
    createdAt;
    updatedAt;
    constructor(data) {
        Object.assign(this, data);
    }
}
exports.TransactionEntity = TransactionEntity;
