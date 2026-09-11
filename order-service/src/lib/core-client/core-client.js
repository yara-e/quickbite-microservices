"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreClient = exports.CoreClient = void 0;
const env_1 = require("../config/env");
const AppError_1 = require("../error/AppError");
const retry_1 = require("../../pkg/utils/retry");
const errors_1 = require("./errors");
class CoreClient {
    baseUrl;
    apiKey;
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }
    async request(req) {
        const url = new URL(req.path, this.baseUrl);
        const headers = {
            "Content-Type": "application/json",
            "api-key": this.apiKey,
        };
        if (req.correlationId)
            headers["X-CorrelationId"] = req.correlationId;
        if (req.idempotencyKey)
            headers["Idempotency-Key"] = req.idempotencyKey;
        return (0, retry_1.retry)(async () => {
            const res = await fetch(url, {
                method: req.method,
                headers,
                body: req.body ? JSON.stringify(req.body) : undefined,
            });
            if (res.status >= 500)
                throw (0, errors_1.coreUnavailableError)(res.status);
            if (!res.ok)
                throw (0, errors_1.coreUpstreamError)(res.status, await res.text().catch(() => ""));
            if (res.status === 204)
                return undefined;
            return (await res.json());
        }, {
            attempts: 3,
            initialDelayMs: 50,
            maxDelayMs: 500,
            isRetryable: (err) => !(err instanceof AppError_1.AppError) || err.statusCode === 503,
        });
    }
}
exports.CoreClient = CoreClient;
exports.coreClient = new CoreClient(env_1.env.core.baseUrl, env_1.env.core.internalApiKey);
