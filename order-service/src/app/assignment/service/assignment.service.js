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
var AssignmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentService = void 0;
const tsyringe_1 = require("tsyringe");
const container_1 = require("../../../lib/di/container");
const tokens_1 = require("../../../lib/di/tokens");
const env_1 = require("../../../lib/config/env");
const knex_1 = require("../../../lib/knex/knex");
const logger_1 = require("../../../lib/logger/logger");
const branch_client_1 = require("../../../lib/core-client/branch.client");
const order_repo_1 = require("../../order/repository/order.repo");
const order_response_dto_1 = require("../../order/dto/order.response.dto");
const agent_response_dto_1 = require("../../agent/dto/agent.response.dto");
const presence_service_1 = require("../../agent/service/presence.service");
const errors_1 = require("../../agent/errors");
let AssignmentService = AssignmentService_1 = class AssignmentService {
    cache;
    presence;
    constructor(cache, presence) {
        this.cache = cache;
        this.presence = presence;
    }
    get io() {
        return container_1.container.resolve(tokens_1.TOKENS.WsServer);
    }
    static offerKey(orderPublicId) {
        return `offer:order:${orderPublicId}`;
    }
    static claimKey(orderPublicId) {
        return `claim:order:${orderPublicId}`;
    }
    static attemptsKey(orderPublicId) {
        return `assign:attempts:${orderPublicId}`;
    }
    /** Worker entrypoint: process up to BATCH ready orders for a region. */
    async tickRegion(region) {
        const conn = (0, knex_1.db)(region);
        const orders = await (0, order_repo_1.findReadyUnassigned)(env_1.env.delivery.batch, conn);
        let offered = 0;
        let skipped = 0;
        for (const o of orders) {
            const result = await this.tryAssign(o, region).catch((err) => {
                logger_1.logger.error("tryAssign failed", { publicId: o.publicId, error: err.message });
                return "error";
            });
            if (result === "offered")
                offered++;
            else
                skipped++;
        }
        return { processed: orders.length, offered, skipped };
    }
    /**
     * Find candidates → broadcast `task.offered` → set offer marker. The
     * acceptance is owned by `claim()` (called from POST /agents/orders/:id/accept).
     */
    async tryAssign(order, region) {
        // Already broadcasting? Don't double-offer until the current offer expires.
        if (await this.cache.exists(AssignmentService_1.offerKey(order.publicId)))
            return "skipped";
        // Cap reassignment attempts. Beyond the cap → admin alert; order stays ready.
        const attemptsRaw = await this.cache.get(AssignmentService_1.attemptsKey(order.publicId));
        const attempts = Number(attemptsRaw ?? 0);
        if (attempts >= env_1.env.delivery.maxAttempts) {
            this.io.to("admin:alerts").emit("assignment.exhausted", { orderId: order.publicId, attempts });
            // extend to update the orders table to alert the restaurat that the order cant be assigned or rely on created_At stamp
            return "exhausted";
        }
        // GEOSEARCH uses the snapshotted branch_lat/branch_lng on the order
        // — zero network calls on the hot path, audit-correct (the assignment
        // distance is always against the branch location at placement time).
        const candidates = await this.findCandidates(region, order.branchLng, order.branchLat);
        if (candidates.length === 0) {
            await this.cache.incr(AssignmentService_1.attemptsKey(order.publicId));
            await this.cache.expire(AssignmentService_1.attemptsKey(order.publicId), 3600);
            return "no-candidates";
        }
        // SETNX with TTL — concurrent worker ticks across multiple processes
        // can't both broadcast the same offer.
        const offerSet = await this.cache.trySet(AssignmentService_1.offerKey(order.publicId), candidates.join(","), env_1.env.delivery.offerTtlSec);
        if (!offerSet)
            return "skipped";
        await this.cache.incr(AssignmentService_1.attemptsKey(order.publicId));
        await this.cache.expire(AssignmentService_1.attemptsKey(order.publicId), 3600);
        // Branch fetch (cache-first) is needed only for the offer payload's
        // human-readable name + addressText. One Redis hit per offer (not
        // per candidate). Failure → omit the display fields rather than block.
        const branch = await (0, branch_client_1.getBranch)(order.branchId).catch(() => null);
        const expiresAt = new Date(Date.now() + env_1.env.delivery.offerTtlSec * 1000).toISOString();
        const payload = {
            orderId: order.publicId,
            branch: {
                id: order.branchId,
                lat: order.branchLat,
                lng: order.branchLng,
                name: branch?.name ?? "",
                addressText: branch?.addressText ?? "",
            },
            dropoff: { lat: order.deliveryLat, lng: order.deliveryLng, addressText: order.deliveryAddressTextSnapshot },
            total: order.total,
            currency: order.currency,
            paymentMethod: order.paymentMethod,
            expiresAt,
        };
        for (const agentId of candidates) {
            this.io.to(`agent:${agentId}`).emit("task.offered", payload);
        }
        logger_1.logger.info("assignment.broadcast", { publicId: order.publicId, candidates, attempts: attempts + 1 });
        return "offered";
    }
    /**
     * Atomic claim. Returns the DeliveryTaskResponseDTO on success;
     * throws OrderAlreadyClaimedError if another agent won the race.
     */
    async claim(publicId, agentId, region) {
        // Verify the agent was offered this order.
        const offered = await this.cache.get(AssignmentService_1.offerKey(publicId));
        if (!offered)
            throw errors_1.OfferNotFoundOrExpiredError;
        const candidateIds = offered.split(",").map(Number);
        if (!candidateIds.includes(agentId))
            throw errors_1.NotInCandidateListError;
        // Atomic SETNX claim — first acceptor wins.
        const ok = await this.cache.trySet(AssignmentService_1.claimKey(publicId), String(agentId), env_1.env.delivery.claimTtlSec);
        if (!ok)
            throw errors_1.OrderAlreadyClaimedError;
        const conn = (0, knex_1.db)(region);
        const trx = await conn.transaction();
        let updated;
        try {
            const order = await (0, order_repo_1.findOrderByPublicId)(publicId, trx);
            if (!order) {
                await this.cache.del(AssignmentService_1.claimKey(publicId));
                throw errors_1.OrderNotInReadyStateError;
            }
            const claimed = await (0, order_repo_1.claimReadyOrderForAgent)(publicId, agentId, trx);
            if (!claimed) {
                await this.cache.del(AssignmentService_1.claimKey(publicId));
                throw errors_1.OrderNotInReadyStateError;
            }
            updated = claimed;
            await trx.commit();
        }
        catch (err) {
            await trx.rollback();
            await this.cache.del(AssignmentService_1.claimKey(publicId));
            throw err;
        }
        await this.presence.markBusy(region, agentId);
        // Fan out: winner -> task.assigned, losers -> offer.cancelled,
        // customer/branch -> order.status_changed.
        const losers = candidateIds.filter((id) => id !== agentId);
        const branch = await (0, branch_client_1.getBranch)(updated.branchId).catch(() => null);
        const taskDto = agent_response_dto_1.DeliveryTaskResponseDTO.from(updated, branch ?? undefined);
        const statusDto = order_response_dto_1.OrderStatusResponseDTO.from(updated);
        this.io.to(`agent:${agentId}`).emit("task.assigned", taskDto);
        for (const loser of losers) {
            this.io.to(`agent:${loser}`).emit("offer.cancelled", { orderId: publicId, reason: "claimed_by_other" });
        }
        this.io.to(`customer:${updated.customerId}`).emit("order.status_changed", statusDto);
        this.io.to(`branch:${updated.branchId}`).emit("order.status_changed", statusDto);
        // Drop the offer marker (claim TTL keeps the lock).
        await this.cache.del(AssignmentService_1.offerKey(publicId));
        return taskDto;
    }
    /** Caller already verified the agent is in the offer; just decrement. */
    async reject(publicId, agentId) {
        const offered = await this.cache.get(AssignmentService_1.offerKey(publicId));
        if (!offered)
            throw errors_1.OfferNotFoundOrExpiredError;
        const candidateIds = offered.split(",").map(Number);
        if (!candidateIds.includes(agentId))
            throw errors_1.NotInCandidateListError;
        const remaining = candidateIds.filter((id) => id !== agentId);
        if (remaining.length === 0) {
            await this.cache.del(AssignmentService_1.offerKey(publicId));
        }
        else {
            const remainingTtl = await this.cache.ttl(AssignmentService_1.offerKey(publicId));
            await this.cache.set(AssignmentService_1.offerKey(publicId), remaining.join(","), Math.max(remainingTtl, 1));
        }
    }
    /**
     * Admin override — bypasses the offer/candidate flow entirely. Force-claims
     * the order for the specified agent regardless of distance/busy state.
     */
    async adminAssign(publicId, agentId, region) {
        const ok = await this.cache.trySet(AssignmentService_1.claimKey(publicId), String(agentId), env_1.env.delivery.claimTtlSec);
        if (!ok)
            throw errors_1.OrderAlreadyClaimedError;
        const conn = (0, knex_1.db)(region);
        const trx = await conn.transaction();
        let updated;
        try {
            const claimed = await (0, order_repo_1.claimReadyOrderForAgent)(publicId, agentId, trx);
            if (!claimed) {
                await this.cache.del(AssignmentService_1.claimKey(publicId));
                throw errors_1.OrderNotInReadyStateError;
            }
            updated = claimed;
            await trx.commit();
        }
        catch (err) {
            await trx.rollback();
            await this.cache.del(AssignmentService_1.claimKey(publicId));
            throw err;
        }
        await this.presence.markBusy(region, agentId);
        const branch = await (0, branch_client_1.getBranch)(updated.branchId).catch(() => null);
        const taskDto = agent_response_dto_1.DeliveryTaskResponseDTO.from(updated, branch ?? undefined);
        const statusDto = order_response_dto_1.OrderStatusResponseDTO.from(updated);
        this.io.to(`agent:${agentId}`).emit("task.assigned", taskDto);
        this.io.to(`customer:${updated.customerId}`).emit("order.status_changed", statusDto);
        this.io.to(`branch:${updated.branchId}`).emit("order.status_changed", statusDto);
        await this.cache.del(AssignmentService_1.offerKey(publicId));
        return taskDto;
    }
    /** GEOSEARCH + filter by presence:meta TTL + filter out busy agents. */
    async findCandidates(region, lng, lat) {
        const overscan = env_1.env.delivery.candidates * 4;
        const raw = await this.cache.geosearchByRadius(presence_service_1.PresenceService.geoKey(region), lng, lat, env_1.env.delivery.radiusMeters, overscan);
        const result = [];
        for (const idStr of raw) {
            const agentId = Number(idStr);
            if (!Number.isFinite(agentId))
                continue;
            if (!(await this.cache.exists(presence_service_1.PresenceService.metaKey(region, agentId))))
                continue;
            if (await this.cache.sismember(presence_service_1.PresenceService.busyKey(region), idStr))
                continue;
            result.push(agentId);
            if (result.length >= env_1.env.delivery.candidates)
                break;
        }
        return result;
    }
};
exports.AssignmentService = AssignmentService;
exports.AssignmentService = AssignmentService = AssignmentService_1 = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.CacheProvider)),
    __param(1, (0, tsyringe_1.inject)(tokens_1.TOKENS.PresenceService)),
    __metadata("design:paramtypes", [Object, presence_service_1.PresenceService])
], AssignmentService);
