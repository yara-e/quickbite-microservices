import {assertTransition} from "@/app/order/service/order-status.service";
import {OrderStatus, StatusActor} from "@/app/order/enums";
import {
    invalidStatusTransitionError,
    ReasonRequiredError,
    CancellationWindowExpiredError,
} from "@/app/order/errors";

describe("order-status.service assertTransition", () => {
    it("allows a restaurant member to accept a placed order", () => {
        const result = assertTransition(OrderStatus.PLACED, OrderStatus.ACCEPTED, {
            actor: StatusActor.RESTAURANT_MEMBER,
        });
        expect(result.stamp).toBe("accepted_at");
    });

    it("rejects an actor who is not allowed for the transition", () => {
        expect(() =>
            assertTransition(OrderStatus.PLACED, OrderStatus.ACCEPTED, {actor: StatusActor.CUSTOMER}),
        ).toThrow(invalidStatusTransitionError(OrderStatus.PLACED, OrderStatus.ACCEPTED));
    });

    it("throws for an unknown/illegal transition", () => {
        expect(() =>
            assertTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.DELIVERED, {
                actor: StatusActor.SYSTEM,
            }),
        ).toThrow(invalidStatusTransitionError(OrderStatus.PENDING_PAYMENT, OrderStatus.DELIVERED));
    });

    it("requires a reason for rejections", () => {
        expect(() =>
            assertTransition(OrderStatus.PLACED, OrderStatus.REJECTED, {
                actor: StatusActor.RESTAURANT_MEMBER,
            }),
        ).toThrow(ReasonRequiredError);

        const ok = assertTransition(OrderStatus.PLACED, OrderStatus.REJECTED, {
            actor: StatusActor.RESTAURANT_MEMBER,
            reason: "out of stock",
        });
        expect(ok.stamp).toBe("rejected_at");
    });

    it("enforces the customer cancel window on placed orders", () => {
        const recent = new Date(Date.now() - 1000);
        expect(() =>
            assertTransition(OrderStatus.PLACED, OrderStatus.CANCELLED, {
                actor: StatusActor.CUSTOMER,
                reason: "changed my mind",
                placedAt: recent,
            }),
        ).not.toThrow();

        const stale = new Date(Date.now() - 120_000);
        expect(() =>
            assertTransition(OrderStatus.PLACED, OrderStatus.CANCELLED, {
                actor: StatusActor.CUSTOMER,
                reason: "changed my mind",
                placedAt: stale,
            }),
        ).toThrow(CancellationWindowExpiredError);
    });

    it("blocks customer cancellation once accepted", () => {
        expect(() =>
            assertTransition(OrderStatus.PLACED, OrderStatus.CANCELLED, {
                actor: StatusActor.CUSTOMER,
                reason: "changed my mind",
                placedAt: new Date(),
                acceptedAt: new Date(Date.now() - 10_000),
            }),
        ).toThrow(CancellationWindowExpiredError);
    });

    it("allows a restaurant member to cancel a placed order (with reason)", () => {
        const result = assertTransition(OrderStatus.PLACED, OrderStatus.CANCELLED, {
            actor: StatusActor.RESTAURANT_MEMBER,
            reason: "no stock",
        });
        expect(result.stamp).toBe("cancelled_at");
    });

    it("allows system to move pending_payment -> placed without stamp", () => {
        const result = assertTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PLACED, {
            actor: StatusActor.SYSTEM,
        });
        expect(result.stamp).toBeNull();
    });

    it("allows agent to pick an assigned order", () => {
        const result = assertTransition(OrderStatus.ASSIGNED, OrderStatus.PICKED, {
            actor: StatusActor.AGENT,
        });
        expect(result.stamp).toBe("picked_at");
    });

    it("allows agent to deliver a picked order", () => {
        const result = assertTransition(OrderStatus.PICKED, OrderStatus.DELIVERED, {
            actor: StatusActor.AGENT,
        });
        expect(result.stamp).toBe("delivered_at");
    });

    it("blocks restaurant member from cancelling an assigned order", () => {
        expect(() =>
            assertTransition(OrderStatus.ASSIGNED, OrderStatus.CANCELLED, {
                actor: StatusActor.RESTAURANT_MEMBER,
                reason: "oops",
            }),
        ).toThrow(invalidStatusTransitionError(OrderStatus.ASSIGNED, OrderStatus.CANCELLED));
    });
});