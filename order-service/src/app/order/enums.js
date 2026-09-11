"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusActor = exports.Currency = exports.PaymentMethod = exports.OrderStatus = void 0;
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING_PAYMENT"] = "pending_payment";
    OrderStatus["PLACED"] = "placed";
    OrderStatus["ACCEPTED"] = "accepted";
    OrderStatus["REJECTED"] = "rejected";
    OrderStatus["PREPARING"] = "preparing";
    OrderStatus["READY"] = "ready";
    OrderStatus["ASSIGNED"] = "assigned";
    OrderStatus["PICKED"] = "picked";
    OrderStatus["DELIVERED"] = "delivered";
    OrderStatus["CANCELLED"] = "cancelled";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["ONLINE"] = "online";
    PaymentMethod["COD"] = "cod";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var Currency;
(function (Currency) {
    Currency["EGP"] = "EGP";
    Currency["SAR"] = "SAR";
})(Currency || (exports.Currency = Currency = {}));
/**
 * Roles allowed to drive a status transition. Resolved from JWT + endpoint.
 * Kept narrow on purpose — restaurant_member covers owner / branch_manager / staff.
 */
var StatusActor;
(function (StatusActor) {
    StatusActor["CUSTOMER"] = "customer";
    StatusActor["RESTAURANT_MEMBER"] = "restaurant_member";
    StatusActor["AGENT"] = "agent";
    StatusActor["SYSTEM"] = "system";
    StatusActor["ADMIN"] = "admin";
})(StatusActor || (exports.StatusActor = StatusActor = {}));
