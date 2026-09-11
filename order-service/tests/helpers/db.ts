import {getHotShard, getArchiveShard, destroyAllShards} from "../../src/lib/knex/shards";

const PRESERVED_TABLES = [
    "knex_migrations",
    "knex_migrations_lock",
    "payment_providers",
];

function tableExpr(): string {
    return PRESERVED_TABLES.map((t) => `'${t}'`).join(", ");
}

/** Truncate all business tables in the given region's hot (and optionally archive) shard. */
export async function truncateRegion(region: string, includeArchive = false): Promise<void> {
    const conns = [getHotShard(region)];
    if (includeArchive) {
        try {
            conns.push(getArchiveShard(region));
        } catch {
            // archive shard may not exist in test env — skip
        }
    }
    for (const conn of conns) {
        const {rows} = await conn.raw<{
            rows: {tablename: string}[];
        }>(
            `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (${tableExpr()})`,
        );
        const tableNames = rows.map((r) => `"${r.tablename}"`).join(", ");
        if (!tableNames) continue;
        await conn.raw(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
    }
}

/** Flush all test shards and their archive shards. */
export async function truncateAll(): Promise<void> {
    const {env} = require("../../src/lib/config/env");
    for (const region of env.regions) {
        await truncateRegion(region, true);
    }
    await clearRedisKeys();
}

/**
 * Clears the Redis keys used by the service (presence, offers, claims, cache,
 * idempotency). Safe to call between tests / after a run.
 */
export async function clearRedisKeys(): Promise<void> {
    try {
        const {cacheProvider} = await import("../../src/lib/cache/init");
        const client = cacheProvider.client;
        await client.flushdb();
    } catch {
        // Redis may be down — tests relying on it will fail loudly on their own.
    }
}

export async function destroyShards(): Promise<void> {
    await destroyAllShards();
}