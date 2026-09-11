import { db } from "../../src/lib/knex/knex";
import { cacheProvider } from "../../src/lib/cache/init";

// Reference/tracking tables that must never be truncated between tests:
// - knex_migrations / lock   → migration bookkeeping used by globalSetup
// - roles, permissions, role_permissions → RBAC catalog seeded by migrations
const PRESERVED_TABLES = [
    "knex_migrations",
    "knex_migrations_lock",
    "roles",
    "permissions",
    "role_permissions",
    "spatial_ref_sys",
];

export async function truncateAll(): Promise<void> {
    await clearRedisKeys();
    const result = await db.raw<{ rows: { tablename: string }[] }>(`
        SELECT tablename from pg_tables
        where schemaname='public'
        AND tableName NOT IN (${PRESERVED_TABLES.map((t) => `'${t}'`).join(", ")})
        `)
    const tableNames = result.rows.map((r) => `"${r.tablename}"`).join(', ')
    if (!tableNames) return;
    await db.raw(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`)
}

/**
 * Clears every key from the shared Redis so caches (idempotency keys, withCache)
 * never leak from one test (or one run) into another.
 */
export async function clearRedisKeys(): Promise<void> {
    try {
        // SCAN is used instead of FLUSHDB so we don't wipe unrelated databases
        // that may share the same Redis instance in dev environments.
        let cursor = "0";
        do {
            const [next, keys] = (await cacheProvider.getClient().scan(
                cursor,
                "MATCH",
                "*",
                "COUNT",
                "200"
            ) as [string, string[]]);
            cursor = next;
            if (keys.length > 0) await cacheProvider.getClient().del(keys);
        } while (cursor !== "0");
    } catch {
        // cache may be down — tests that rely on it failing open will handle it
    }
}
