"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idempotency = idempotency;
const container_1 = require("../di/container");
const tokens_1 = require("../di/tokens");
const time_1 = require("../../pkg/utils/time");
const TTL = (0, time_1.toSeconds)(1, "d");
// Phase 0 implementation: Redis-only. DB-backed durable store is activated in
// Phase 1 when the `idempotency_keys` table lands.
function idempotency(options = {}) {
    const { strict = false } = options;
    return async (req, res, next) => {
        if (!["POST", "PATCH", "PUT"].includes(req.method))
            return next();
        const idempotencyKey = req.headers["idempotency-key"];
        if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
            if (strict) {
                return res.status(400).json({ error: "Missing Idempotency-Key header" });
            }
            return next();
        }
        try {
            const cacheProvider = container_1.container.resolve(tokens_1.TOKENS.CacheProvider);
            const key = `idempotency:${req.method}:${req.originalUrl}:${idempotencyKey}`;
            const cached = await cacheProvider.get(key);
            if (cached) {
                return res.status(200).json(JSON.parse(cached));
            }
            const originalJson = res.json.bind(res);
            res.json = ((body) => {
                cacheProvider.set(key, JSON.stringify(body), TTL).catch(() => { });
                return originalJson(body);
            });
            next();
        }
        catch {
            if (strict) {
                return res.status(503).json({ error: "Idempotency service unavailable" });
            }
            next();
        }
    };
}
