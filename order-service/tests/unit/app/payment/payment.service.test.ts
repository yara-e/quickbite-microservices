import {PaymentService} from "@/app/payment/service/payment.service";
import {PaymentSessionStatus, PaymentProviderName, PAYMENT_PROVIDER_IDS} from "@/app/payment/enums";
import {PaymentProviderUnavailableError, PaymentNotFoundError} from "@/app/payment/errors";
import {UnAuthorisedError} from "@/lib/auth/errors";

jest.mock("@/lib/knex/knex", () => ({
    db: jest.fn(),
}));
jest.mock("@/app/payment/repository/payment-session.repo", () => ({
    findActiveSessionByOrderId: jest.fn(),
    createSession: jest.fn(),
}));
jest.mock("@/app/payment/repository/transaction.repo", () => ({
    findTransactionWithRestaurant: jest.fn(),
}));
jest.mock("@/lib/logger/logger", () => ({
    logger: {error: jest.fn()},
}));

import {db} from "@/lib/knex/knex";
import {findActiveSessionByOrderId, createSession as createSessionRepo} from "@/app/payment/repository/payment-session.repo";
import {findTransactionWithRestaurant} from "@/app/payment/repository/transaction.repo";
import {PaymentSessionEntity} from "@/app/payment/entity/payment-session.entity";
import {OrderEntity} from "@/app/order/entity/order.entity";
import {OrderStatus, PaymentMethod, Currency} from "@/app/order/enums";

const dbMock = db as jest.Mock;
const findActiveMock = findActiveSessionByOrderId as jest.Mock;
const createSessionRepoMock = createSessionRepo as jest.Mock;
const findTxMock = findTransactionWithRestaurant as jest.Mock;

function makeOrder(): OrderEntity {
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
        status: OrderStatus.PENDING_PAYMENT,
        subtotal: 5000,
        deliveryFee: 500,
        serviceFee: 1000,
        total: 6500,
        commission: 0,
        currency: Currency.EGP,
        paymentMethod: PaymentMethod.ONLINE,
        deliveryAgentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        acceptedAt: null,
        rejectedAt: null,
        readyAt: null,
        assignedAt: null,
        pickedAt: null,
        deliveredAt: null,
        cancelledAt: null,
    });
}

function makeSession(overrides: Partial<PaymentSessionEntity> = {}): PaymentSessionEntity {
    return new PaymentSessionEntity({
        id: 3,
        region: "eg",
        orderId: 1,
        providerId: PAYMENT_PROVIDER_IDS[PaymentProviderName.KASHIER],
        providerSessionId: "ps-1",
        redirectUrl: "https://pay.example/x",
        amount: 6500,
        currency: "EGP",
        status: PaymentSessionStatus.INITIALIZED,
        rawInitPayload: {},
        rawLastPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });
}
describe("app/payment/payment.service", () => {
    let kashier: any;
    let service: PaymentService;

    beforeEach(() => {
        jest.clearAllMocks();
        kashier = {
            createSession: jest.fn(),
            verifyWebhook: jest.fn(),
        };
        service = new PaymentService(kashier);
        dbMock.mockReturnValue("conn");
    });

    describe("initOnlinePayment", () => {
        it("returns an existing active session when present", async () => {
            const existing = makeSession();
            findActiveMock.mockResolvedValue(existing);

            const result = await service.initOnlinePayment(makeOrder());

            expect(result.session).toBe(existing);
            expect(result.dto.sessionId).toBe("3");
            expect(kashier.createSession).not.toHaveBeenCalled();
            expect(createSessionRepoMock).not.toHaveBeenCalled();
        });

        it("creates a session via kashier when none exists", async () => {
            findActiveMock.mockResolvedValue(undefined);
            kashier.createSession.mockResolvedValue({
                providerSessionId: "ps-new",
                redirectUrl: "https://pay.example/new",
                rawResponse: {_id: "ps-new"},
                expiresAt: "2026-02-01T00:00:00.000Z",
            });
            createSessionRepoMock.mockResolvedValue(makeSession({providerSessionId: "ps-new"}));

            const result = await service.initOnlinePayment(makeOrder());

            expect(kashier.createSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    merchantOrderId: "pub-1",
                    amount: "65.00",
                    currency: "EGP",
                }),
            );
            expect(createSessionRepoMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderId: 1,
                    providerSessionId: "ps-new",
                }),
                "conn",
            );
            expect(result.expiresAt).toBe("2026-02-01T00:00:00.000Z");
        });

        it("throws PaymentProviderUnavailableError when the provider fails", async () => {
            findActiveMock.mockResolvedValue(undefined);
            kashier.createSession.mockRejectedValue(new Error("timeout"));

            await expect(service.initOnlinePayment(makeOrder())).rejects.toBe(PaymentProviderUnavailableError);
            expect(createSessionRepoMock).not.toHaveBeenCalled();
        });
    });

    describe("getById", () => {
        it("returns the payment DTO for a transaction of the caller's restaurant", async () => {
            findTxMock.mockResolvedValue({
                transaction: makeSession() as any,
                restaurantId: 10,
            });

            const dto = await service.getById(3, 10, "eg");
            expect(dto.id).toBe(3);
        });

        it("throws PaymentNotFoundError when missing", async () => {
            findTxMock.mockResolvedValue(undefined);
            await expect(service.getById(3, 10, "eg")).rejects.toBe(PaymentNotFoundError);
        });

        it("throws UnAuthorisedError when the payment belongs to another restaurant", async () => {
            findTxMock.mockResolvedValue({
                transaction: makeSession() as any,
                restaurantId: 99,
            });
            await expect(service.getById(3, 10, "eg")).rejects.toBe(UnAuthorisedError);
        });
    });
});