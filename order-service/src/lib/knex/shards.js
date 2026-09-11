"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHotShard = getHotShard;
exports.getArchiveShard = getArchiveShard;
exports.destroyAllShards = destroyAllShards;
exports.listConfiguredRegions = listConfiguredRegions;
const knex_1 = __importDefault(require("knex"));
const env_1 = require("../config/env");
const regions_1 = require("../sharding/regions");
function buildConfig(shard) {
    return {
        client: "pg",
        connection: {
            host: shard.host,
            port: shard.port,
            user: shard.username,
            password: shard.password,
            database: shard.name,
        },
        pool: {
            min: 0,
            max: env_1.env.db.poolMax,
        },
        migrations: {
            directory: env_1.env.db.migrationDirectory,
            extension: env_1.env.db.migrationExtension,
        },
    };
}
const hotByRegion = new Map();
const archiveByRegion = new Map();
function getHotShard(region) {
    (0, regions_1.assertRegion)(region);
    let conn = hotByRegion.get(region);
    if (!conn) {
        conn = (0, knex_1.default)(buildConfig(env_1.env.hotShards[region]));
        hotByRegion.set(region, conn);
    }
    return conn;
}
function getArchiveShard(region) {
    (0, regions_1.assertRegion)(region);
    let conn = archiveByRegion.get(region);
    if (!conn) {
        conn = (0, knex_1.default)(buildConfig(env_1.env.archiveShards[region]));
        archiveByRegion.set(region, conn);
    }
    return conn;
}
async function destroyAllShards() {
    await Promise.all([...hotByRegion.values()].map((c) => c.destroy()));
    await Promise.all([...archiveByRegion.values()].map((c) => c.destroy()));
    hotByRegion.clear();
    archiveByRegion.clear();
}
function listConfiguredRegions(cluster) {
    return Object.keys(cluster === "hot" ? env_1.env.hotShards : env_1.env.archiveShards);
}
