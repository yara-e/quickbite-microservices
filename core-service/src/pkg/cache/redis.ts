import Redis from "ioredis";
import type { ICacheProvider } from "./cache.interface";

export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
}

export class RedisCacheProvider implements ICacheProvider {
    private readonly client: Redis;

    constructor(private readonly config: RedisConfig) {
        this.client = new Redis({
            host: config.host,
            port: config.port,
            password: config.password,
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            enableAutoPipelining: true, // Optimizes concurrent load test requests automatically
        });

        this.client.on("error", (err) => {
            console.error("[Redis Error]:", err.message);
        });

        this.client.connect().catch((err) => {
            console.error("[Redis Connection Error]:", err.message);
        });
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds) {
            await this.client.set(key, value, "EX", ttlSeconds);
        } else {
            await this.client.set(key, value);
        }
    }

    async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    async del(key: string): Promise<number> {
        return this.client.del(key);
    }

    getClient(): Redis {
        return this.client;
    }
}