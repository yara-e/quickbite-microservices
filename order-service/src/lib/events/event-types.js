"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_TYPES = void 0;
/**
 * Outbound event type constants emitted by order-service.
 * Routing keys consumed by analytics-service and any future subscribers.
 *
 * Naming: <aggregate>.<past-tense-verb>.
 */
exports.EVENT_TYPES = {
    ORDER_PLACED: "order.placed",
    ORDER_ACCEPTED: "order.accepted",
    ORDER_REJECTED: "order.rejected",
    ORDER_DELIVERED: "order.delivered",
    ORDER_CANCELLED: "order.cancelled",
    PAYMENT_COMPLETED: "payment.completed",
    PAYMENT_FAILED: "payment.failed",
};
