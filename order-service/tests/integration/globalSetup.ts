import "reflect-metadata";
import {config} from "dotenv";
import path from "path";

config({path: path.resolve(__dirname, "../../.env.test")});

/**
 * Runs migrations against every configured test shard (hot + archive), then
 * seeds the payment_providers table (the migration only seeds it when
 * REGION=eg, which a migration runner can't express for multiple regions).
 */
export default async function globalSetup(): Promise<void> {
    const {env} = require("../../src/lib/config/env");
    const {getHotShard, getArchiveShard} = require("../../src/lib/knex/shards");

    for (const region of env.regions) {
        const hot = getHotShard(region);
        await hot.migrate.latest();
        await ensurePaymentProvider(hot);

        // Archive shards may not exist in test environments — best-effort.
        try {
            const archive = getArchiveShard(region);
            await archive.migrate.latest();
        } catch {
            // skip archive
        }
    }
}

async function ensurePaymentProvider(conn: any): Promise<void> {
    await conn("payment_providers")
        .insert({
            id: 1,
            name: "kashier",
            is_enabled: true,
            priority: 10,
        })
        .onConflict("id")
        .ignore();
}