"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCacheProvider = void 0;
class RedisCacheProvider {
    client;
    /**
     * Exposed so integrations that need the raw ioredis connection (e.g. the
     * socket.io redis adapter) can reuse it instead of opening another one.
     * The adapter still needs its own subscriber via `client.duplicate()` —
     * once ioredis is in subscribe mode it can't serve get/set.
     */
    constructor(client) {
        this.client = client;
    }
    // ── Strings ──────────────────────────────────────────────────────────
    async get(key) {
        return this.client.get(key);
    }
    async set(key, value, ttlSeconds) {
        if (ttlSeconds) {
            await this.client.set(key, value, "EX", ttlSeconds);
        }
        else {
            await this.client.set(key, value);
        }
    }
    async del(key) {
        return this.client.del(key);
    }
    async trySet(key, value, ttlSeconds) {
        const res = ttlSeconds
            ? await this.client.set(key, value, "EX", ttlSeconds, "NX")
            : await this.client.set(key, value, "NX");
        return res === "OK";
    }
    async exists(key) {
        return (await this.client.exists(key)) === 1;
    }
    async incr(key) {
        return this.client.incr(key);
    }
    async expire(key, ttlSeconds) {
        await this.client.expire(key, ttlSeconds);
    }
    async ttl(key) {
        return this.client.ttl(key);
    }
    // ── Hashes ───────────────────────────────────────────────────────────
    async hsetWithTtl(key, fields, ttlSeconds) {
        // HSET + EXPIRE in a single round-trip via MULTI. If we did them
        // sequentially, a crash between the two would leave a hash without a
        // TTL — i.e. an agent who silently became "permanently online".
        const tx = this.client.multi().hset(key, fields);
        if (ttlSeconds)
            tx.expire(key, ttlSeconds);
        await tx.exec();
    }
    // ── Sets ─────────────────────────────────────────────────────────────
    async sadd(key, member) {
        await this.client.sadd(key, member);
    }
    async srem(key, member) {
        await this.client.srem(key, member);
    }
    async sismember(key, member) {
        return (await this.client.sismember(key, member)) === 1;
    }
    // ── Geo / sorted sets ────────────────────────────────────────────────
    async geoadd(key, lng, lat, member) {
        await this.client.geoadd(key, lng, lat, member);
    }
    // delivery_agents
    async zrem(key, member) {
        await this.client.zrem(key, member);
    }
    async geosearchByRadius(key, fromLng, fromLat, radiusMeters, count) {
        const raw = (await this.client.geosearch(key, "FROMLONLAT", fromLng, fromLat, "BYRADIUS", radiusMeters, "m", "ASC", "COUNT", count));
        return raw;
    }
}
exports.RedisCacheProvider = RedisCacheProvider;
