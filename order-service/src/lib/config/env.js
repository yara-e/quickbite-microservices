"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = require("dotenv");
const zod_1 = require("zod");
// C:\Users\ABDULLAH\Desktop\quickbite\order-service\.env
(0, dotenv_1.config)({ path: path_1.default.resolve(__dirname, "../../../.env") });
const baseSchema = zod_1.z.object({
    PORT: zod_1.z.string().default("4000"),
    NODE_ENV: zod_1.z.string().default("development"),
    ACCESS_SECRET: zod_1.z.string(),
    REFRESH_SECRET: zod_1.z.string(),
    ACCESS_EXPIRES_IN: zod_1.z.string().default("3600"),
    REFRESH_EXPIRES_IN: zod_1.z.string().default("604800"),
    CORS_ORIGINS: zod_1.z.string().default("http://localhost:3000"),
    REGIONS: zod_1.z.string().min(1),
    DB_POOL_MAX: zod_1.z.string().default("10"),
    DB_MIGRATION_DIRECTORY: zod_1.z.string().default("src/migrations"),
    DB_MIGRATION_EXTENSION: zod_1.z.string().default("ts"),
    REDIS_HOST: zod_1.z.string().default("localhost"),
    REDIS_PORT: zod_1.z.string().default("6379"),
    REDIS_PASSWORD: zod_1.z.string().default(""),
    RABBITMQ_URL: zod_1.z.string(),
    RABBITMQ_CORE_EVENTS_EXCHANGE: zod_1.z.string().default("core.events"),
    RABBITMQ_CORE_EVENTS_QUEUE: zod_1.z.string().default("order-service.core-events"),
    RABBITMQ_CORE_EVENTS_BINDINGS: zod_1.z
        .string()
        .default("product.#,branch.#,restaurant.#,rbac.#"),
    RABBITMQ_CORE_EVENTS_DLX: zod_1.z.string().default("core.events.dlx"),
    RABBITMQ_CORE_EVENTS_DLQ: zod_1.z.string().default("order-service.core-events.dlq"),
    RABBITMQ_PREFETCH: zod_1.z.string().default("32"),
    // Outbound: order.events exchange consumed by analytics-service & friends
    RABBITMQ_ORDER_EVENTS_EXCHANGE: zod_1.z.string().default("order.events"),
    OUTBOUND_EVENTS_DRAIN_TICK_SEC: zod_1.z.string().default("2"),
    OUTBOUND_EVENTS_BATCH_SIZE: zod_1.z.string().default("100"),
    CORE_SERVICE_BASE_URL: zod_1.z.string(),
    CORE_INTERNAL_API_KEY: zod_1.z.string(),
    WS_HEARTBEAT_SEC: zod_1.z.string().default("30"),
    KASHIER_BASE_URL: zod_1.z.string().default("https://test-api.kashier.io"),
    KASHIER_FEP_BASE_URL: zod_1.z.string().default("https://test-fep.kashier.io"),
    KASHIER_MERCHANT_ID: zod_1.z.string(),
    KASHIER_API_KEY: zod_1.z.string(),
    KASHIER_SECRET_KEY: zod_1.z.string(),
    KASHIER_PAYMENT_TYPE: zod_1.z.string().default("credit"),
    KASHIER_RETURN_URL: zod_1.z.string(),
    KASHIER_FAIL_URL: zod_1.z.string(),
    KASHIER_WEBHOOK_URL: zod_1.z.string(),
    PAYMENT_SESSION_TIMEOUT_MIN: zod_1.z.string().default("15"),
    ONLINE_PAYMENT_REGIONS: zod_1.z.string().default("eg"),
    // Deliveries / agents
    PRESENCE_STALE_SEC: zod_1.z.string().default("300"), // 5 min — TTL on presence:meta:*
    ASSIGNMENT_TICK_SEC: zod_1.z.string().default("10"), // worker tick cadence
    ASSIGNMENT_RADIUS_METERS: zod_1.z.string().default("5000"),
    ASSIGNMENT_CANDIDATES: zod_1.z.string().default("5"), // top N agents per offer
    ASSIGNMENT_OFFER_TTL_SEC: zod_1.z.string().default("30"), // offer:order:* lifetime
    ASSIGNMENT_CLAIM_TTL_SEC: zod_1.z.string().default("300"), // claim:order:* lifetime
    ASSIGNMENT_MAX_ATTEMPTS: zod_1.z.string().default("3"),
    ASSIGNMENT_BATCH: zod_1.z.string().default("20"), // ready orders processed per tick
    AGENT_EARNING_SHARE_BPS: zod_1.z.string().default("8000"), // 80% of order.delivery_fee
});
const parsed = baseSchema.parse(process.env);
function parseRegions(raw) {
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}
function readShardConfig(region, prefix) {
    // eg, DB
    const hostKey = `${prefix}_${region}_HOST`;
    const portKey = `${prefix}_${region}_PORT`;
    const userKey = `${prefix}_${region}_USERNAME`;
    const passKey = `${prefix}_${region}_PASSWORD`;
    const nameKey = `${prefix}_${region}_NAME`;
    const host = process.env[hostKey];
    const port = process.env[portKey];
    const username = process.env[userKey];
    const password = process.env[passKey];
    const name = process.env[nameKey];
    if (!host || !port || !username || name === undefined) {
        throw new Error(`Missing ${prefix} env for region "${region}". Expected: ${hostKey}, ${portKey}, ${userKey}, ${passKey}, ${nameKey}`);
    }
    return {
        host,
        port: Number(port),
        username,
        password: password ?? "",
        name,
    };
}
const regions = parseRegions(parsed.REGIONS);
const hotShards = {};
const archiveShards = {};
for (const region of regions) {
    hotShards[region] = readShardConfig(region, "DB");
    archiveShards[region] = readShardConfig(region, "ARCHIVE_DB");
}
exports.env = {
    port: Number(parsed.PORT),
    isProduction: parsed.NODE_ENV === "production",
    cors: { origins: parsed.CORS_ORIGINS.split(",").map((s) => s.trim()) },
    jwt: {
        accessSecret: parsed.ACCESS_SECRET,
        refreshSecret: parsed.REFRESH_SECRET,
        accessExpiresIn: parsed.ACCESS_EXPIRES_IN,
        refreshExpiresIn: parsed.REFRESH_EXPIRES_IN,
    },
    db: {
        poolMax: Number(parsed.DB_POOL_MAX),
        migrationDirectory: path_1.default.resolve(__dirname, "../../../", parsed.DB_MIGRATION_DIRECTORY),
        migrationExtension: parsed.DB_MIGRATION_EXTENSION,
    },
    regions,
    hotShards,
    archiveShards,
    redis: {
        host: parsed.REDIS_HOST,
        port: Number(parsed.REDIS_PORT),
        password: parsed.REDIS_PASSWORD || undefined,
    },
    rabbit: {
        url: parsed.RABBITMQ_URL,
        exchange: parsed.RABBITMQ_CORE_EVENTS_EXCHANGE,
        queue: parsed.RABBITMQ_CORE_EVENTS_QUEUE,
        bindings: parsed.RABBITMQ_CORE_EVENTS_BINDINGS.split(",").map((s) => s.trim()),
        dlx: parsed.RABBITMQ_CORE_EVENTS_DLX,
        dlq: parsed.RABBITMQ_CORE_EVENTS_DLQ,
        prefetch: Number(parsed.RABBITMQ_PREFETCH),
    },
    outboundEvents: {
        exchange: parsed.RABBITMQ_ORDER_EVENTS_EXCHANGE,
        drainTickSec: Number(parsed.OUTBOUND_EVENTS_DRAIN_TICK_SEC),
        batchSize: Number(parsed.OUTBOUND_EVENTS_BATCH_SIZE),
    },
    core: {
        baseUrl: parsed.CORE_SERVICE_BASE_URL,
        internalApiKey: parsed.CORE_INTERNAL_API_KEY,
    },
    ws: {
        heartbeatSec: Number(parsed.WS_HEARTBEAT_SEC),
    },
    kashier: {
        baseUrl: parsed.KASHIER_BASE_URL,
        fepBaseUrl: parsed.KASHIER_FEP_BASE_URL,
        merchantId: parsed.KASHIER_MERCHANT_ID,
        apiKey: parsed.KASHIER_API_KEY,
        secretKey: parsed.KASHIER_SECRET_KEY,
        paymentType: parsed.KASHIER_PAYMENT_TYPE,
        returnUrl: parsed.KASHIER_RETURN_URL,
        failUrl: parsed.KASHIER_FAIL_URL,
        webhookUrl: parsed.KASHIER_WEBHOOK_URL,
    },
    payments: {
        sessionTimeoutMin: Number(parsed.PAYMENT_SESSION_TIMEOUT_MIN),
        onlineRegions: new Set(parsed.ONLINE_PAYMENT_REGIONS
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length > 0)),
    },
    delivery: {
        presenceStaleSec: Number(parsed.PRESENCE_STALE_SEC),
        assignmentTickSec: Number(parsed.ASSIGNMENT_TICK_SEC),
        radiusMeters: Number(parsed.ASSIGNMENT_RADIUS_METERS),
        candidates: Number(parsed.ASSIGNMENT_CANDIDATES),
        offerTtlSec: Number(parsed.ASSIGNMENT_OFFER_TTL_SEC),
        claimTtlSec: Number(parsed.ASSIGNMENT_CLAIM_TTL_SEC),
        maxAttempts: Number(parsed.ASSIGNMENT_MAX_ATTEMPTS),
        batch: Number(parsed.ASSIGNMENT_BATCH),
        agentEarningShareBps: Number(parsed.AGENT_EARNING_SHARE_BPS),
    },
};
