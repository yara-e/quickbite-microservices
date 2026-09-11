"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCache = withCache;
const container_1 = require("../di/container");
const tokens_1 = require("../di/tokens");
function withCache(ttl = 3600, userScoped = false) {
    return async (req, res, next) => {
        try {
            const cacheProvider = container_1.container.resolve(tokens_1.TOKENS.CacheProvider);
            let key = `${req.method}:${req.originalUrl}`;
            if (userScoped)
                key = `${key}:${req.user?.userId}`;
            if (req.region)
                key = `${req.region}:${key}`;
            const cached = await cacheProvider.get(key);
            if (cached) {
                res.setHeader("X-Cache", "HIT");
                return res.status(200).json(JSON.parse(cached));
            }
            const originalJson = res.json.bind(res);
            res.json = ((body) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    cacheProvider.set(key, JSON.stringify(body), ttl).catch(() => { });
                }
                res.setHeader("X-Cache", "MISS");
                return originalJson(body);
            });
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
