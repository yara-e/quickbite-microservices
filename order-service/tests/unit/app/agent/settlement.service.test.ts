import {SettlementService} from "@/app/agent/service/settlement.service";
import {NotYourTaskError} from "@/app/agent/errors";
import {OrderStatus, PaymentMethod, Currency} from "@/app/order/enums";

jest.mock("@/lib/knex/knex", () => ({
    db: jest.fn(),
}));
jest.mock("@/app/order/repository/order.repo", () => ({
    findOrderByPublicId: jest.fn(),
    updateOrderStatus: jest.fn(),
    updateOrderCommission: jest.fn(),
}));
jest.mock("@/app/payment/repository/transaction.repo", () => ({
    createTransactionIdempotent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/app/finance/repository/restaurant-balance.repo", () => ({
    upsertIncrement: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/app/agent/repository/agent-earning.repo", () => ({
    insertEarning: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/events/outbox.repo", () => ({
    insertOutboxEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/core-client/branch.client", () => ({
    getBranch: jest.fn(),
    getBranchesByIds: jest.fn(),
}));
jest.mock("@/lib/di/container", () => ({
    container: {resolve: jest.fn()},
}));
jest.mock("@/lib/logger/logger", () => ({
    logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()},
}));

import {db} from "@/lib/knex/knex";
import {findOrderByPublicId, updateOrderStatus, updateOrderCommission} from "@/app/order/repository/order.repo";
import {createTransactionIdempotent} from "@/app/payment/repository/transaction.repo";
import {upsertIncrement} from "@/app/finance/repository/restaurant-balance.repo";
import {insertEarning} from "@/app/agent/repository/agent-earning.repo";
import {insertOutboxEvent} from "@/lib/events/outbox.repo";
import {getBranch} from "@/lib/core-client/branch.client";
import {container} from "@/lib/di/container";
import {OrderEntity} from "@/app/order/entity/order.entity";

const dbMock = db as jest.Mock;
const findOrderMock = findOrderByPublicId as jest.Mock;
const updateStatusMock = updateOrderStatus as jest.Mock;
const updateCommissionMock = updateOrderCommission as jest.Mock;
const createTxMock = createTransactionIdempotent as jest.Mock;
const upsertMock = upsertIncrement as jest.Mock;
const insertEarningMock = insertEarning as jest.Mock;
const insertOutboxMock = insertOutboxEvent as jest.Mock;
const branchMock = getBranch as jest.Mock;
const resolveMock = container.resolve as jest.Mock;

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
        deliveryLat: 30,
        deliveryLng: 31,
        deliveryAddressTextSnapshot: "1 Main St",
        branchLat: 30,
        branchLng: 31,
        status: OrderStatus.PICKED,
        subtotal: 5000,
        deliveryFee: 500,
        serviceFee: 1000,
        total: 6500,
        commission: 0,
        currency: Currency.EGP,
        paymentMethod: PaymentMethod.COD,
        deliveryAgentId: 7,
        createdAt: new Date(),
        updatedAt: new Date(),
        acceptedAt: new Date(),
        readyAt: new Date(),
        assignedAt: new Date(),
        pickedAt: new Date(),
        rejectedAt: null,
        deliveredAt: null,
        cancelledAt: null,
        ...overrides,
    });
}
describe("app/agent/settlement.service", () => {
    let cache: any;
    let presence: any;
    let service: SettlementService;

    beforeEach(() => {
        jest.clearAllMocks();
        resolveMock.mockReturnValue({to: jest.fn().mockReturnValue({emit: jest.fn()})});
        cache = {del: jest.fn().mockResolvedValue(1)};
        presence = {clearBusy: jest.fn().mockResolvedValue(undefined)};
        service = new SettlementService(presence, cache);
        dbMock.mockReturnValue({transaction: jest.fn()});
        branchMock.mockResolvedValue({commissionBps: 1000});
    });

    it("throws when the order is not found", async () => {
        findOrderMock.mockResolvedValue(undefined);
        await expect(service.settleDelivered("pub-1", 7, "eg")).rejects.toThrow("OrderNotFound");
    });

    it("throws NotYourTask when the agent does not hold the order", async () => {
        findOrderMock.mockResolvedValue(makeOrder({deliveryAgentId: 8}));
        await expect(service.settleDelivered("pub-1", 7, "eg")).rejects.toBe(NotYourTaskError);
    });

    it("settles a COD delivery with commission + earning + balance + outbox", async () => {
        const order = makeOrder();
        findOrderMock.mockResolvedValue(order);
        const trx = {
            commit: jest.fn().mockResolvedValue(undefined),
            rollback: jest.fn().mockResolvedValue(undefined),
        };
        dbMock.mockReturnValue({transaction: jest.fn().mockResolvedValue(trx)});
        const delivered = makeOrder({status: OrderStatus.DELIVERED, deliveredAt: new Date()});
        updateStatusMock.mockResolvedValue(delivered);

        const result = await service.settleDelivered("pub-1", 7, "eg");

        expect(result.status).toBe(OrderStatus.DELIVERED);
        expect(updateCommissionMock).toHaveBeenCalledWith("pub-1", 500, trx);
        expect(createTxMock).toHaveBeenCalledWith(
            expect.objectContaining({transactionType: "cod_collection", amount: 6500}),
            trx,
        );
        expect(upsertMock).toHaveBeenCalledWith(
            {restaurantId: 10, region: "eg", currency: "EGP", delta: 4500},
            trx,
        );
        expect(insertEarningMock).toHaveBeenCalledWith(
            {region: "eg", agentId: 7, orderId: 1, amount: 400, currency: "EGP"},
            trx,
        );
        expect(trx.commit).toHaveBeenCalled();
        expect(insertOutboxMock).toHaveBeenCalledWith(trx, expect.objectContaining({
            aggregateType: "order",
            eventType: "order.delivered",
        }));
        expect(presence.clearBusy).toHaveBeenCalledWith("eg", 7);
        expect(cache.del).toHaveBeenCalledWith("claim:order:pub-1");
    });

    it("leaves commission at 0 when the branch fetch fails", async () => {
        findOrderMock.mockResolvedValue(makeOrder());
        branchMock.mockRejectedValue(new Error("core down"));
        const trx = {commit: jest.fn().mockResolvedValue(undefined), rollback: jest.fn()};
        dbMock.mockReturnValue({transaction: jest.fn().mockResolvedValue(trx)});
        updateStatusMock.mockResolvedValue(makeOrder({status: OrderStatus.DELIVERED}));

        await service.settleDelivered("pub-1", 7, "eg");

        expect(updateCommissionMock).toHaveBeenCalledWith("pub-1", 0, trx);
        expect(upsertMock).toHaveBeenCalledWith(
            {restaurantId: 10, region: "eg", currency: "EGP", delta: 5000},
            trx,
        );
    });

    it("rolls back and rethrows on any failure", async () => {
        findOrderMock.mockResolvedValue(makeOrder());
        const trx = {commit: jest.fn(), rollback: jest.fn().mockResolvedValue(undefined)};
        dbMock.mockReturnValue({transaction: jest.fn().mockResolvedValue(trx)});
        createTxMock.mockRejectedValue(new Error("db boom"));

        await expect(service.settleDelivered("pub-1", 7, "eg")).rejects.toThrow("db boom");
        expect(trx.rollback).toHaveBeenCalled();
    });
});