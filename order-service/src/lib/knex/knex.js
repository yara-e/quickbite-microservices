"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = db;
exports.dbArchive = dbArchive;
exports.destroyAll = destroyAll;
exports.pingAll = pingAll;
const shards_1 = require("./shards");
/**
 * Returns the hot-cluster connection for the given region.
 * Use this for transactional / strongly-consistent reads.
 */
function db(region) {
    return (0, shards_1.getHotShard)(region);
}
/**
 * Returns the archive-cluster connection for the given region.
 * Consumed starting Phase 7.
 */
function dbArchive(region) {
    return (0, shards_1.getArchiveShard)(region);
}
async function destroyAll() {
    await (0, shards_1.destroyAllShards)();
}
async function pingAll() {
    const out = [];
    for (const region of (0, shards_1.listConfiguredRegions)("hot")) {
        out.push(await pingOne(region, "hot"));
    }
    // Archive ping is best-effort; it may not exist in dev.
    for (const region of (0, shards_1.listConfiguredRegions)("archive")) {
        out.push(await pingOne(region, "archive"));
    }
    return out;
}
async function pingOne(region, cluster) {
    try {
        const conn = cluster === "hot" ? (0, shards_1.getHotShard)(region) : (0, shards_1.getArchiveShard)(region);
        await conn.raw("SELECT 1");
        return { region, cluster, ok: true };
    }
    catch (err) {
        return { region, cluster, ok: false, error: err.message };
    }
}
