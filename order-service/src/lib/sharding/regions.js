"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGIONS = void 0;
exports.normalizeRegion = normalizeRegion;
exports.isRegion = isRegion;
exports.assertRegion = assertRegion;
const env_1 = require("../config/env");
// Region codes are normalized to lowercase. Country codes from core may
// arrive uppercase ("EG") or from clients in either case; the router
// always works on lowercase.
const set = new Set(env_1.env.regions.map((r) => r.toLowerCase()));
exports.REGIONS = env_1.env.regions;
function normalizeRegion(candidate) {
    return typeof candidate === "string" ? candidate.toLowerCase() : undefined;
}
function isRegion(candidate) {
    const norm = normalizeRegion(candidate);
    return !!norm && set.has(norm);
}
function assertRegion(candidate) {
    const norm = normalizeRegion(candidate);
    if (!norm || !set.has(norm)) {
        throw new Error(`Unknown region: "${candidate}". Known: ${env_1.env.regions.join(",")}`);
    }
    return norm;
}
