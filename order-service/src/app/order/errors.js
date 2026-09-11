"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnlinePaymentNotAvailableError = exports.ReasonRequiredError = exports.CancellationWindowExpiredError = exports.BranchNotAcceptingOrdersError = exports.OrderNotFoundError = void 0;
exports.invalidStatusTransitionError = invalidStatusTransitionError;
exports.outOfStockError = outOfStockError;
const AppError_1 = require("../../lib/error/AppError");
exports.OrderNotFoundError = new AppError_1.AppError("OrderNotFound", 404);
exports.BranchNotAcceptingOrdersError = new AppError_1.AppError("BranchNotAcceptingOrders", 409);
exports.CancellationWindowExpiredError = new AppError_1.AppError("CancellationWindowExpired", 409);
exports.ReasonRequiredError = new AppError_1.AppError("Reason required for this transition", 400);
exports.OnlinePaymentNotAvailableError = new AppError_1.AppError("OnlinePaymentNotAvailableInRegion", 409);
function invalidStatusTransitionError(from, to) {
    return new AppError_1.AppError(`InvalidStatusTransition: ${from} -> ${to}`, 409);
}
function outOfStockError(offending) {
    return new AppError_1.AppError(`OutOfStock: ${JSON.stringify(offending)}`, 409);
}
