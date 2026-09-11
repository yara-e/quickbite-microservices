import {PaymentSessionEntity} from "@/app/payment/entity/payment-session.entity";
import {TransactionEntity} from "@/app/payment/entity/transaction.entity";
import {PaymentSessionStatus, TransactionType, TransactionMethod, TransactionStatus} from "@/app/payment/enums";
import {PaymentInitResponseDTO, PaymentResponseDTO} from "@/app/payment/dto/payment.response.dto";

describe("app/payment payment.response.dto", () => {
    it("PaymentInitResponseDTO.from maps the session", () => {
        const session = new PaymentSessionEntity({
            id: 3,
            region: "eg",
            orderId: 1,
            providerId: 1,
            providerSessionId: "ps-1",
            redirectUrl: "https://pay/x",
            amount: 6500,
            currency: "EGP",
            status: PaymentSessionStatus.INITIALIZED,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
        });

        const dto = PaymentInitResponseDTO.from(session, "2026-01-01T00:15:00.000Z");
        expect(dto.sessionId).toBe("3");
        expect(dto.providerSessionId).toBe("ps-1");
        expect(dto.amount).toBe(6500);
        expect(dto.expiresAt).toBe("2026-01-01T00:15:00.000Z");
    });

    it("PaymentResponseDTO.from maps a kashier transaction", () => {
        const tx = new TransactionEntity({
            id: 9,
            region: "eg",
            orderId: 1,
            transactionType: TransactionType.CHARGE,
            method: TransactionMethod.ONLINE,
            providerId: 1,
            providerReferenceId: "ref-1",
            status: TransactionStatus.SUCCEEDED,
            amount: 6500,
            currency: "EGP",
            srcAccId: 1,
            dstAccId: null,
            isRefunded: false,
            refundedPaymentId: null,
            idempotencyKey: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
        });

        const dto = PaymentResponseDTO.from(tx);
        expect(dto.id).toBe(9);
        expect(dto.provider).toBe("kashier");
        expect(dto.providerReferenceId).toBe("ref-1");
        expect(dto.isRefunded).toBe(false);
    });

    it("PaymentResponseDTO.from maps a provider-less (system) transaction to null provider", () => {
        const tx = new TransactionEntity({
            id: 10,
            region: "eg",
            orderId: null,
            transactionType: TransactionType.COMMISSION,
            method: TransactionMethod.SYSTEM,
            providerId: null,
            providerReferenceId: null,
            status: TransactionStatus.SUCCEEDED,
            amount: 100,
            currency: "EGP",
            srcAccId: 1,
            dstAccId: 2,
            isRefunded: false,
            refundedPaymentId: null,
            idempotencyKey: "k",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
        });

        const dto = PaymentResponseDTO.from(tx);
        expect(dto.provider).toBeNull();
        expect(dto.orderId).toBeNull();
    });
});