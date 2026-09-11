"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KashierClient = void 0;
const retry_1 = require("../../utils/retry");
const kashier_signature_1 = require("./kashier.signature");
class KashierClient {
    cfg;
    constructor(cfg) {
        this.cfg = cfg;
    }
    async createSession(input) {
        const expireAt = new Date(Date.now() + this.cfg.sessionTimeoutSec * 1000).toISOString();
        const body = {
            merchantId: this.cfg.merchantId,
            paymentType: this.cfg.paymentType,
            amount: input.amount,
            currency: input.currency,
            order: input.merchantOrderId,
            type: "one-time",
            allowedMethods: input.allowedMethods ?? "card,wallet",
            enable3DS: true,
            serverWebhook: this.cfg.serverWebhookUrl,
            merchantRedirect: this.cfg.merchantRedirect,
            failureRedirect: this.cfg.failureRedirectEnabled ?? false,
            description: input.description,
            interactionSource: "ECOMMERCE",
            expireAt,
            customer: { reference: input.customerReference },
        };
        const response = await (0, retry_1.retry)(async () => {
            const res = await fetch(`${this.cfg.baseUrl}/v3/payment/sessions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": this.cfg.apiKey,
                    "Authorization": this.cfg.secretKey,
                },
                body: JSON.stringify(body),
            });
            if (res.status >= 500) {
                throw new Error(`kashier ${res.status}: ${await res.text().catch(() => "")}`);
            }
            if (!res.ok) {
                // Non-retryable upstream error (4xx) — surface verbatim.
                const text = await res.text().catch(() => "");
                const err = new Error(`kashier ${res.status}: ${text}`);
                err.statusCode = res.status;
                err.retryable = false;
                throw err;
            }
            return (await res.json());
        }, {
            attempts: 3,
            initialDelayMs: 200,
            maxDelayMs: 1500,
            isRetryable: (err) => err?.retryable !== false,
        });
        if (!response?._id || !response?.sessionUrl) {
            throw new Error(`kashier: malformed session response: ${JSON.stringify(response)}`);
        }
        return {
            providerSessionId: response._id,
            redirectUrl: response.sessionUrl,
            rawResponse: response,
            expiresAt: response.expireAt ?? expireAt,
        };
    }
    verifyWebhook(input) {
        return (0, kashier_signature_1.verifyWebhookSignature)(input.payload, input.signatureKeys, this.cfg.apiKey, input.signature);
    }
}
exports.KashierClient = KashierClient;
