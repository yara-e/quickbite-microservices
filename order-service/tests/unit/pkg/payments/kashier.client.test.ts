import {KashierClient} from "@/pkg/payments/kashier/kashier.client";

describe("pkg/payments/kashier/kashier.client", () => {
    let client: KashierClient;
    let fetchMock: jest.Mock;
    const cfg = {
        baseUrl: "https://api.kashier.test",
        merchantId: "MID-1",
        apiKey: "api-key-1",
        secretKey: "secret",
        paymentType: "credit",
        serverWebhookUrl: "https://webhook.test/x",
        merchantRedirect: "https://return.test",
        failureRedirectEnabled: false,
        sessionTimeoutSec: 900,
    };

    beforeEach(() => {
        client = new KashierClient(cfg);
        fetchMock = jest.fn();
        global.fetch = fetchMock as any;
    });

    it("creates a session with the expected Kashier request shape", async () => {
        fetchMock.mockResolvedValue({
            status: 200,
            ok: true,
            json: jest.fn().mockResolvedValue({
                _id: "sess-1",
                sessionUrl: "https://pay.example/s",
                expireAt: "2026-02-01T00:00:00.000Z",
            }),
        });

        const result = await client.createSession({
            merchantOrderId: "pub-1",
            amount: "65.00",
            currency: "EGP",
            description: "QuickBite order pub-1",
            allowedMethods: "card,wallet",
            customerReference: "30",
        });

        expect(result.providerSessionId).toBe("sess-1");
        expect(result.redirectUrl).toBe("https://pay.example/s");
        expect(result.rawResponse).toMatchObject({_id: "sess-1"});

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://api.kashier.test/v3/payment/sessions");
        expect(init.headers["api-key"]).toBe("api-key-1");
        expect(init.headers["Authorization"]).toBe("secret");

        const body = JSON.parse(init.body);
        expect(body).toMatchObject({
            merchantId: "MID-1",
            paymentType: "credit",
            amount: "65.00",
            currency: "EGP",
            order: "pub-1",
            type: "one-time",
            allowedMethods: "card,wallet",
            enable3DS: true,
            serverWebhook: "https://webhook.test/x",
            customer: {reference: "30"},
        });
        expect(body.expireAt).toBeTruthy();
    });

    it("retries on a 5xx then succeeds", async () => {
        fetchMock
            .mockResolvedValueOnce({status: 503, ok: false, text: jest.fn().mockResolvedValue("")})
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                json: jest.fn().mockResolvedValue({_id: "s", sessionUrl: "https://pay/x"}),
            });

        const result = await client.createSession({
            merchantOrderId: "pub-1",
            amount: "10",
            currency: "EGP",
            customerReference: "1",
        });
        expect(result.providerSessionId).toBe("s");
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws a non-retryable error on a 4xx", async () => {
        fetchMock.mockResolvedValue({status: 400, ok: false, text: jest.fn().mockResolvedValue("bad request")});

        await expect(
            client.createSession({
                merchantOrderId: "pub-1",
                amount: "10",
                currency: "EGP",
                customerReference: "1",
            }),
        ).rejects.toThrow();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws on a malformed response", async () => {
        fetchMock.mockResolvedValue({
            status: 200,
            ok: true,
            json: jest.fn().mockResolvedValue({}),
        });

        await expect(
            client.createSession({
                merchantOrderId: "pub-1",
                amount: "10",
                currency: "EGP",
                customerReference: "1",
            }),
        ).rejects.toThrow(/malformed session response/);
    });

    it("verifyWebhook delegates to the signature verifier", () => {
        const ok = client.verifyWebhook({
            payload: {a: 1},
            signatureKeys: ["a"],
            signature: "x".repeat(64),
        });
        expect(typeof ok).toBe("boolean");
    });
});