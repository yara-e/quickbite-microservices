import {
    buildSignaturePayload,
    computeWebhookSignature,
    verifyWebhookSignature,
} from "@/pkg/payments/kashier/kashier.signature";

describe("pkg/payments/kashier.signature", () => {
    const data = {
        amount: "100.00",
        transactionId: "tx-1",
        currency: "EGP",
    };
    const keys = ["transactionId", "currency", "amount"];

    it("builds a sorted key=encoded&... payload", () => {
        const payload = buildSignaturePayload(data, keys);
        // keys sorted alphabetically: amount, currency, transactionId
        expect(payload).toBe("amount=100.00&currency=EGP&transactionId=tx-1");
    });

    it("encodes special characters", () => {
        const payload = buildSignaturePayload(
            {name: "a b&c:1"},
            ["name"],
        );
        expect(payload).toBe("name=a%20b%26c%3A1");
    });

    it("treats undefined/null values as empty", () => {
        const payload = buildSignaturePayload(
            {a: undefined, b: null, c: "x"},
            ["a", "b", "c"],
        );
        expect(payload).toBe("a=&b=&c=x");
    });

    it("computes a deterministic HMAC-SHA256 hex digest", () => {
        const sig1 = computeWebhookSignature(data, keys, "api-key");
        const sig2 = computeWebhookSignature(data, keys, "api-key");
        expect(sig1).toHaveLength(64);
        expect(sig1).toBe(sig2);
    });

    it("verifies a valid signature and rejects wrong ones", () => {
        const sig = computeWebhookSignature(data, keys, "api-key");
        expect(verifyWebhookSignature(data, keys, "api-key", sig)).toBe(true);
        expect(verifyWebhookSignature(data, keys, "api-key", "0".repeat(64))).toBe(false);
        expect(verifyWebhookSignature(data, keys, "other-key", sig)).toBe(false);
    });

    it("rejects empty/malformed signatures", () => {
        expect(verifyWebhookSignature(data, keys, "api-key", "")).toBe(false);
        expect(verifyWebhookSignature(data, keys, "api-key", "abc")).toBe(false);
    });
});