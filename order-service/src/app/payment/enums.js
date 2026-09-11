"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_PROVIDER_IDS = exports.PaymentProviderName = exports.TransactionStatus = exports.TransactionMethod = exports.TransactionType = exports.PaymentSessionStatus = void 0;
var PaymentSessionStatus;
(function (PaymentSessionStatus) {
    PaymentSessionStatus["INITIALIZED"] = "initialized";
    PaymentSessionStatus["PENDING"] = "pending";
    PaymentSessionStatus["AUTHORIZED"] = "authorized";
    PaymentSessionStatus["CAPTURED"] = "captured";
    PaymentSessionStatus["FAILED"] = "failed";
    PaymentSessionStatus["EXPIRED"] = "expired";
    PaymentSessionStatus["CANCELLED"] = "cancelled";
})(PaymentSessionStatus || (exports.PaymentSessionStatus = PaymentSessionStatus = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["CHARGE"] = "charge";
    TransactionType["REFUND"] = "refund";
    TransactionType["COMMISSION"] = "commission";
    TransactionType["PAYOUT"] = "payout";
    TransactionType["COD_COLLECTION"] = "cod_collection";
    TransactionType["ADJUSTMENT"] = "adjustment";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var TransactionMethod;
(function (TransactionMethod) {
    TransactionMethod["ONLINE"] = "online";
    TransactionMethod["COD"] = "cod";
    TransactionMethod["BANK_TRANSFER"] = "bank_transfer";
    TransactionMethod["SYSTEM"] = "system";
})(TransactionMethod || (exports.TransactionMethod = TransactionMethod = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "pending";
    TransactionStatus["SUCCEEDED"] = "succeeded";
    TransactionStatus["FAILED"] = "failed";
    TransactionStatus["REVERSED"] = "reversed";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
var PaymentProviderName;
(function (PaymentProviderName) {
    PaymentProviderName["KASHIER"] = "kashier";
    PaymentProviderName["COD"] = "cod";
})(PaymentProviderName || (exports.PaymentProviderName = PaymentProviderName = {}));
exports.PAYMENT_PROVIDER_IDS = {
    [PaymentProviderName.KASHIER]: 1,
    [PaymentProviderName.COD]: 2,
};
