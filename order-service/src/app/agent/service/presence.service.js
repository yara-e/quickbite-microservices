"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PresenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceService = void 0;
const tsyringe_1 = require("tsyringe");
const tokens_1 = require("../../../lib/di/tokens");
const env_1 = require("../../../lib/config/env");
const knex_1 = require("../../../lib/knex/knex");
const enums_1 = require("../../order/enums");
const errors_1 = require("../errors");
/**
 * Redis-only agent presence. The 5-minute TTL on `presence:meta:*` is the
 * "online" signal — if pings stop the key vanishes and the agent is treated
 * as offline. There is NO Postgres mirror.
 *
 * Key schema (region-namespaced — see database-design.md §8):
 *   presence:meta:<region>:<agentId>     hash {lat,lng,lastSeenAt}, TTL = PRESENCE_STALE_SEC
 *   presence:geo:<region>                geo set (GEOADD on every ping)
 *   presence:busy:<region>               set of agent ids currently holding an assignment
 *
 * Key names are exposed as static helpers so other services (assignment,
 * settlement) can read/write the same Redis state without duplicating the
 * naming convention.
 */
let PresenceService = PresenceService_1 = class PresenceService {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    static metaKey(region, agentId) {
        return `presence:meta:${region}:${agentId}`;
    }
    static geoKey(region) {
        return `presence:geo:${region}`;
    }
    static busyKey(region) {
        return `presence:busy:${region}`;
    }
    /** Online and ping share the same write path — UPSERT + extend TTL. */
    async upsert(region, agentId, lat, lng) {
        const ttl = env_1.env.delivery.presenceStaleSec;
        await this.cache.hsetWithTtl(PresenceService_1.metaKey(region, agentId), { lat: String(lat), lng: String(lng), lastSeenAt: String(Date.now()) }, ttl);
        await this.cache.geoadd(PresenceService_1.geoKey(region), lng, lat, String(agentId));
    }
    /**
     * Reject if the agent is currently holding an order in `picked` (food in
     * transit). For `assigned`, we reset the order to `ready` so the worker
     * re-broadcasts on the next tick.
     */
    async goOffline(region, agentId) {
        const conn = (0, knex_1.db)(region);
        const stuck = await conn("orders")
            .select("public_id", "status")
            .where({ delivery_agent_id: agentId, status: enums_1.OrderStatus.PICKED })
            .first();
        if (stuck)
            throw errors_1.OfflineWhilePickedForbidden;
        await conn("orders")
            .where({ delivery_agent_id: agentId, status: enums_1.OrderStatus.ASSIGNED })
            .update({ delivery_agent_id: null, status: enums_1.OrderStatus.READY, assigned_at: null, updated_at: conn.fn.now() });
        await this.cache.del(PresenceService_1.metaKey(region, agentId));
        await this.cache.zrem(PresenceService_1.geoKey(region), String(agentId));
        await this.cache.srem(PresenceService_1.busyKey(region), String(agentId));
    }
    async markBusy(region, agentId) {
        await this.cache.sadd(PresenceService_1.busyKey(region), String(agentId));
    }
    async clearBusy(region, agentId) {
        await this.cache.srem(PresenceService_1.busyKey(region), String(agentId));
    }
};
exports.PresenceService = PresenceService;
exports.PresenceService = PresenceService = PresenceService_1 = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.CacheProvider)),
    __metadata("design:paramtypes", [Object])
], PresenceService);
