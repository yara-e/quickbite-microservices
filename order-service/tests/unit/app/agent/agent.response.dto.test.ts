import {OrderEntity} from "@/app/order/entity/order.entity";
import {OrderStatus, PaymentMethod, Currency} from "@/app/order/enums";
import {DeliveryTaskResponseDTO, AgentEarningsResponseDTO} from "@/app/agent/dto/agent.response.dto";
import {AgentEarningEntity} from "@/app/agent/entity/agent-earning.entity";

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
        status: OrderStatus.ASSIGNED,
        subtotal: 5000,
        deliveryFee: 500,
        serviceFee: 1000,
        total: 6500,
        commission: 0,
        currency: Currency.EGP,
        paymentMethod: PaymentMethod.COD,
        deliveryAgentId: 7,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        acceptedAt: new Date("2026-01-01T00:01:00Z"),
        assignedAt: new Date("2026-01-01T00:02:00Z"),
        pickedAt: null,
        deliveredAt: null,
        rejectedAt: null,
        readyAt: new Date("2026-01-01T00:01:00Z"),
        cancelledAt: null,
        ...overrides,
    });
}

describe("app/agent agent.response.dto", () => {
    it("DeliveryTaskResponseDTO.from maps branch info when provided", () => {
        const dto = DeliveryTaskResponseDTO.from(makeOrder(), {
            lat: 30.1,
            lng: 31.2,
            name: "Downtown",
            addressText: "12 Main St",
        });

        expect(dto.orderId).toBe("pub-1");
        expect(dto.status).toBe(OrderStatus.ASSIGNED);
        expect(dto.pickup).toMatchObject({
            branchId: 20,
            name: "Downtown",
            addressText: "12 Main St",
        });
        expect(dto.dropoff).toMatchObject({addressText: "1 Main St"});
        expect(dto.assignedAt).toBe("2026-01-01T00:02:00.000Z");
    });

    it("DeliveryTaskResponseDTO.from leaves pickup nulls without a branch", () => {
        const dto = DeliveryTaskResponseDTO.from(makeOrder());
        expect(dto.pickup.lat).toBeNull();
        expect(dto.pickup.name).toBeNull();
    });

    it("AgentEarningsResponseDTO.from groups range/totals/items", () => {
        const from = new Date("2026-01-01T00:00:00Z");
        const to = new Date("2026-02-01T00:00:00Z");
        const items = [
            new AgentEarningEntity({
                id: 1,
                region: "eg",
                agentId: 7,
                orderId: 1,
                amount: 400,
                currency: Currency.EGP,
                earnedAt: new Date("2026-01-05T00:00:00Z"),
            }),
        ];

        const dto = AgentEarningsResponseDTO.from(from, to, items, 400);

        expect(dto.range).toEqual({
            from: "2026-01-01T00:00:00.000Z",
            to: "2026-02-01T00:00:00.000Z",
        });
        expect(dto.totals).toEqual({count: 1, sum: 400, currency: "EGP"});
        expect(dto.items[0]).toMatchObject({orderId: 1, amount: 400});
    });
});