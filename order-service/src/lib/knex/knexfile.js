"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../config/env");
/**
 * Builds a knex config for the region+cluster identified by env vars.
 *   REGION=eg|ksa|...   (required — no default so migrations can never silently hit the wrong shard)
 *   CLUSTER=hot|archive (defaults to "hot")
 *
 * Drives `npm run migrate`, `migrate:rollback`, etc. The per-process shard
 * connections used by the running app come from `knex.ts`, not this file.
 */
const region = process.env.REGION;
if (!region) {
    throw new Error("REGION env var is required (e.g. `REGION=eg npm run migrate`)");
}
const cluster = (process.env.CLUSTER ?? "hot");
const shards = cluster === "hot" ? env_1.env.hotShards : env_1.env.archiveShards;
const shard = shards[region];
if (!shard) {
    throw new Error(`No ${cluster} shard configured for region "${region}"`);
}
const config = {
    client: "pg",
    connection: {
        host: shard.host,
        port: shard.port,
        user: shard.username,
        password: shard.password,
        database: shard.name,
    },
    pool: { min: 0, max: env_1.env.db.poolMax },
    migrations: {
        directory: env_1.env.db.migrationDirectory,
        extension: env_1.env.db.migrationExtension,
    },
};
exports.default = config;
