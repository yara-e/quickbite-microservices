"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheProvider = exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redis_1 = require("../../pkg/cache/redis");
const env_1 = require("../config/env");
/**
 * Single ioredis connection shared by the cache provider (for get/set/del)
 * and — via duplicate() — the socket.io redis adapter (which needs a
 * separate subscriber connection).
 */
exports.redisClient = new ioredis_1.default({
    host: env_1.env.redis.host,
    port: env_1.env.redis.port,
    password: env_1.env.redis.password,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
});
exports.redisClient.on("error", (err) => console.error("Redis Error:", err.message));
exports.redisClient.connect().catch((err) => console.error("Redis Connect Error:", err.message));
exports.cacheProvider = new redis_1.RedisCacheProvider(exports.redisClient);
