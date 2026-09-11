"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MalformedWebhookError = exports.InvalidWebhookSignatureError = exports.PaymentNotFoundError = exports.PaymentProviderUnavailableError = exports.OrderNotPendingPaymentError = void 0;
const AppError_1 = require("../../lib/error/AppError");
exports.OrderNotPendingPaymentError = new AppError_1.AppError("OrderNotPendingPayment", 409);
exports.PaymentProviderUnavailableError = new AppError_1.AppError("Payment provider unavailable", 503);
exports.PaymentNotFoundError = new AppError_1.AppError("PaymentNotFound", 404);
exports.InvalidWebhookSignatureError = new AppError_1.AppError("InvalidSignature", 401);
exports.MalformedWebhookError = new AppError_1.AppError("MalformedWebhook", 400);
