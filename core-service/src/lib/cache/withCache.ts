import { Request, Response, NextFunction } from "express";
import { ICacheProvider } from "../../pkg/cache/cache.interface";
import { container } from "../di/container";
import { TOKENS } from "../di/tokens";

export function withCache(ttl = 3600, userScoped = false) {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Cache GET requests only
        if (req.method !== "GET") {
            return next();
        }

        try {
            const cacheProvider: ICacheProvider = container.resolve(TOKENS.CacheProvider);

            let key = `cache:${req.method}:${req.originalUrl}`;

            if (userScoped) {
                const userId = req.user?.userId;
                if (!userId) {
                    // Do not serve or write user-scoped cache if unauthenticated
                    return next();
                }
                key = `${key}:user:${userId}`;
            }

            const cached = await cacheProvider.get(key);
            if (cached) {
                res.setHeader("X-Cache", "HIT");
                res.setHeader("Content-Type", "application/json");
                // Bypass JSON.parse() and res.json() completely — send raw string directly
                return res.status(200).send(cached);
            }

            // Cache Miss logic
            res.setHeader("X-Cache", "MISS");
            const originalJson = res.json.bind(res);

            res.json = ((body: any) => {
                // Restore original res.json first to avoid recursive loops
                res.json = originalJson;

                // Cache successful responses asynchronously without blocking response cycle
                if (res.statusCode >= 200 && res.statusCode < 300 && body) {
                    const stringified = typeof body === "string" ? body : JSON.stringify(body);
                    cacheProvider.set(key, stringified, ttl).catch((err) => {
                        console.error(`[Redis] Cache set error for key ${key}:`, err.message);
                    });
                }

                return originalJson(body);
            }) as any;

            next();
        } catch (err) {
            // Fail open: if Redis GET fails, log error and proceed to database/controller
            console.error("[Redis] Cache fetch failure, bypassing cache:", err);
            next();
        }
    };
}