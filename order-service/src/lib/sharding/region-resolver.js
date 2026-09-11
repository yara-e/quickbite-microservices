"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRegion = resolveRegion;
exports.requireRegion = requireRegion;
exports.requireConcreteRegion = requireConcreteRegion;
const regions_1 = require("./regions");
const errors_1 = require("./errors");
/**
 * Reads the region from `X-Region` header first, then falls back to the
 * `?region=` query string. The query fallback exists because external
 * callers we don't control (e.g. Kashier webhooks) can put a query string
 * on the URL but can't add custom headers.
 *
 * "all" is preserved for admin fan-out reads; routes that need a single
 * shard should additionally use `requireConcreteRegion`.
 */
function resolveRegion(req, _res, next) {
    const headerRaw = req.headers["x-region"];
    const headerValue = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    const queryValue = typeof req.query.region === "string" ? req.query.region : undefined;
    const norm = (0, regions_1.normalizeRegion)(headerValue ?? queryValue);
    if (norm === "all") {
        req.region = "all";
    }
    else if (norm && (0, regions_1.isRegion)(norm)) {
        req.region = norm;
    }
    next();
}
function requireRegion(req, _res, next) {
    if (!req.region)
        throw errors_1.RegionNotResolvedError;
    next();
}
/**
 * Stricter than `requireRegion`: rejects `req.region === "all"` so that
 * single-shard endpoints (writes, lookups by id) never silently fan out.
 */
function requireConcreteRegion(req, _res, next) {
    if (!req.region || req.region === "all")
        throw errors_1.RegionNotResolvedError;
    next();
}
