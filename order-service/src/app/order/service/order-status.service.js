"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTransition = assertTransition;
const enums_1 = require("../enums");
const errors_1 = require("../errors");
/**
 * Status machine. Each entry is `from -> to -> rule`. Anything not listed is
 * a forbidden transition and returns 409 InvalidStatusTransition.
 *
 * `assigned` and `delivered` are NOT exposed on the public PATCH /orders/{id}/status
 * endpoint — they are written by the assignment / delivery services as part of
 * Phase 3+. Listing them here keeps the table honest as those phases land.
 */
const TRANSITIONS = {
    [enums_1.OrderStatus.PENDING_PAYMENT]: {
        [enums_1.OrderStatus.PLACED]: { actors: [enums_1.StatusActor.SYSTEM], stamp: null },
        [enums_1.OrderStatus.CANCELLED]: { actors: [enums_1.StatusActor.CUSTOMER, enums_1.StatusActor.SYSTEM], stamp: "cancelled_at" },
    },
    [enums_1.OrderStatus.PLACED]: {
        [enums_1.OrderStatus.ACCEPTED]: { actors: [enums_1.StatusActor.RESTAURANT_MEMBER], stamp: "accepted_at" },
        [enums_1.OrderStatus.REJECTED]: { actors: [enums_1.StatusActor.RESTAURANT_MEMBER], stamp: "rejected_at", requiresReason: true },
        [enums_1.OrderStatus.CANCELLED]: { actors: [enums_1.StatusActor.CUSTOMER, enums_1.StatusActor.RESTAURANT_MEMBER, enums_1.StatusActor.SYSTEM, enums_1.StatusActor.ADMIN], stamp: "cancelled_at", requiresReason: true },
    },
    [enums_1.OrderStatus.ACCEPTED]: {
        [enums_1.OrderStatus.PREPARING]: { actors: [enums_1.StatusActor.RESTAURANT_MEMBER], stamp: null },
        [enums_1.OrderStatus.CANCELLED]: { actors: [enums_1.StatusActor.RESTAURANT_MEMBER, enums_1.StatusActor.ADMIN], stamp: "cancelled_at", requiresReason: true },
    },
    [enums_1.OrderStatus.PREPARING]: {
        [enums_1.OrderStatus.READY]: { actors: [enums_1.StatusActor.RESTAURANT_MEMBER], stamp: "ready_at" },
        [enums_1.OrderStatus.CANCELLED]: { actors: [enums_1.StatusActor.RESTAURANT_MEMBER, enums_1.StatusActor.ADMIN], stamp: "cancelled_at", requiresReason: true },
    },
    [enums_1.OrderStatus.READY]: {
        [enums_1.OrderStatus.ASSIGNED]: { actors: [enums_1.StatusActor.SYSTEM], stamp: "assigned_at" },
        [enums_1.OrderStatus.CANCELLED]: { actors: [enums_1.StatusActor.RESTAURANT_MEMBER, enums_1.StatusActor.ADMIN], stamp: "cancelled_at", requiresReason: true },
    },
    [enums_1.OrderStatus.ASSIGNED]: {
        [enums_1.OrderStatus.PICKED]: { actors: [enums_1.StatusActor.AGENT], stamp: "picked_at" },
        [enums_1.OrderStatus.CANCELLED]: { actors: [enums_1.StatusActor.ADMIN], stamp: "cancelled_at", requiresReason: true },
    },
    [enums_1.OrderStatus.PICKED]: {
        [enums_1.OrderStatus.DELIVERED]: { actors: [enums_1.StatusActor.AGENT], stamp: "delivered_at" },
    },
};
/**
 * Customer cancellation has a tight window: until accepted_at is set OR within
 * 60 seconds of placed_at (proxied via created_at on a placed order).
 */
const CUSTOMER_CANCEL_WINDOW_MS = 60 * 1000;
/**
 * Validates a status transition. Throws AppError on illegal transition / missing
 * permissions / missing reason / customer cancel window expired.
 */
function assertTransition(from, to, ctx) {
    const allowed = TRANSITIONS[from]?.[to];
    if (!allowed) {
        throw (0, errors_1.invalidStatusTransitionError)(from, to);
    }
    if (!allowed.actors.includes(ctx.actor)) {
        throw (0, errors_1.invalidStatusTransitionError)(from, to);
    }
    if (allowed.requiresReason && (!ctx.reason || ctx.reason.trim().length === 0)) {
        throw errors_1.ReasonRequiredError;
    }
    if (ctx.actor === enums_1.StatusActor.CUSTOMER && to === enums_1.OrderStatus.CANCELLED && from === enums_1.OrderStatus.PLACED) {
        if (ctx.acceptedAt)
            throw errors_1.CancellationWindowExpiredError;
        if (ctx.placedAt && Date.now() - ctx.placedAt.getTime() > CUSTOMER_CANCEL_WINDOW_MS) {
            throw errors_1.CancellationWindowExpiredError;
        }
    }
    return { stamp: allowed.stamp };
}
