import {OrderEntity} from "@/app/order/entity/order.entity";
import {OrderItemEntity} from "@/app/order/entity/order-item.entity";
import {OrderStatus, PaymentMethod, Currency} from "@/app/order/enums";
import {
    OrderResponseDTO,
    OrderDetailResponseDTO,
    OrderSummaryResponseDTO,
    OrderStatusResponseDTO,
} from "@/app/order/dto/order.response.dto";

function makeOrder(overrides: Partial<OrderEntity> = {}): OrderEntity {
    return new OrderEntity({
        id: 1,
        region: "eg",
        publicId: "pub-1",
        countryCode: "EG",
        restaurantId: 10,
        restaurantOwnerId: 11,
        branchId: 20,
        customerId: 30,
        customerAddressId: 40,
        deliveryLat: 30.04,
        deliveryLng: 31.23,
        deliveryAddressTextSnapshot: "1 Main St",
        branchLat: 30.05,
        branchLng: 31.24,
        status: OrderStatus.PLACED,
        subtotal: 5000,
        deliveryFee: 500,
        serviceFee: 1000,
        total: 6500,
        commission: 0,
        currency: Currency.EGP,
        paymentMethod: PaymentMethod.COD,
        deliveryAgentId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        acceptedAt: null,
        rejectedAt: null,
        readyAt: null,
        assignedAt: null,
        pickedAt: null,
        deliveredAt: null,
        cancelledAt: null,
        ...overrides,
    });
}

function makeItem(overrides: Partial<OrderItemEntity> = {}): OrderItemEntity {
    return new OrderItemEntity({
        id: 1,
        region: "eg",
        orderId: 1,
        productId: 9,
        quantity: 2,
        unitPriceSnapshot: 2500,
        nameSnapshot: "Burger",
        imageUrlSnapshot: null,
        lineTotal: 5000,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        ...overrides,
    });
}

describe("app/order order.response.dto", () => {
    it("OrderResponseDTO.from maps all fields + optional payment info", () => {
        const dto = OrderResponseDTO.from(makeOrder(), [makeItem()], {
            sessionId: "s1",
            providerSessionId: "p1",
            redirectUrl: "https://pay/x",
            expiresAt: "2026-01-01T00:15:00.000Z",
        });

        expect(dto.publicId).toBe("pub-1");
        expect(dto.branch).toEqual({id: 20});
        expect(dto.restaurant).toEqual({id: 10});
        expect(dto.total).toBe(6500);
        expect(dto.items).toHaveLength(1);
        expect(dto.items[0]).toMatchObject({productId: 9, name: "Burger", quantity: 2});
        expect(dto.payment).toMatchObject({sessionId: "s1", redirectUrl: "https://pay/x"});
    });

    it("OrderResponseDTO.from omits the payment block when absent", () => {
        const dto = OrderResponseDTO.from(makeOrder(), []);
        expect(dto.payment).toBeUndefined();
    });

    it("OrderDetailResponseDTO builds the history timeline", () => {
        const order = makeOrder({
            paymentMethod: PaymentMethod.ONLINE,
            acceptedAt: new Date("2026-01-01T00:05:00Z"),
            deliveredAt: new Date("2026-01-01T00:30:00Z"),
        });
        const dto = OrderDetailResponseDTO.from(order, []);

        const statuses = dto.history.map((h) => h.status);
        expect(statuses).toContain(OrderStatus.PENDING_PAYMENT);
        expect(statuses).toContain(OrderStatus.PLACED);
        expect(statuses).toContain(OrderStatus.ACCEPTED);
        expect(statuses).toContain(OrderStatus.DELIVERED);
    });

    it("OrderSummaryResponseDTO.from counts items", () => {
        const dto = OrderSummaryResponseDTO.from(makeOrder(), 3);
        expect(dto.itemsCount).toBe(3);
        expect(dto.branchId).toBe(20);
        expect(dto.restaurant).toEqual({id: 10});
    });

    it("OrderStatusResponseDTO.from exposes publicId/status/updatedAt", () => {
        const dto = OrderStatusResponseDTO.from(makeOrder());
        expect(dto.publicId).toBe("pub-1");
        expect(dto.status).toBe(OrderStatus.PLACED);
        expect(dto.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    });
});