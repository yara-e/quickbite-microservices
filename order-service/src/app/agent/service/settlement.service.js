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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementService = void 0;
const tsyringe_1 = require("tsyringe");
const container_1 = require("../../../lib/di/container");
const tokens_1 = require("../../../lib/di/tokens");
const knex_1 = require("../../../lib/knex/knex");
const env_1 = require("../../../lib/config/env");
const logger_1 = require("../../../lib/logger/logger");
const branch_client_1 = require("../../../lib/core-client/branch.client");
const enums_1 = require("../../order/enums");
const order_repo_1 = require("../../order/repository/order.repo");
const order_response_dto_1 = require("../../order/dto/order.response.dto");
const transaction_repo_1 = require("../../payment/repository/transaction.repo");
const enums_2 = require("../../payment/enums");
const restaurant_balance_repo_1 = require("../../finance/repository/restaurant-balance.repo");
const agent_earning_repo_1 = require("../repository/agent-earning.repo");
const presence_service_1 = require("./presence.service");
const errors_1 = require("../errors");
const assignment_service_1 = require("../../assignment/service/assignment.service");
const outbox_repo_1 = require("../../../lib/events/outbox.repo");
const event_types_1 = require("../../../lib/events/event-types");
/**
 * Single trx that runs on the `delivered` transition. Handles:
 *   1. COD: insert cod_collection / succeeded (if not already there).
 *   2. Commission: compute + write commission tx, fill orders.commission.
 *      (Phase 4 turns the commission part on; Phase 3 leaves it at 0 if
 *      `commissionBps` is 0/missing.)
 *   3. Restaurant balance: += (subtotal - commission).
 *   4. Agent earning: floor(delivery_fee × AGENT_EARNING_SHARE_BPS / 10000).
 *   5. orders.status = delivered, delivered_at = now().
 *
 * After-commit: free the agent in Redis, drop the claim lock, WS.
 */
let SettlementService = class SettlementService {
    presence;
    cache;
    constructor(presence, cache) {
        this.presence = presence;
        this.cache = cache;
    }
    get io() {
        return container_1.container.resolve(tokens_1.TOKENS.WsServer);
    }
    async settleDelivered(publicId, agentId, region) {
        const conn = (0, knex_1.db)(region);
        // Pre-trx fetch (read-only) so we can pull commissionBps from core's cache
        // without holding row locks across an HTTP call.
        const order = await (0, order_repo_1.findOrderByPublicId)(publicId, conn);
        if (!order)
            throw new Error("OrderNotFound");
        if (order.deliveryAgentId !== agentId)
            throw errors_1.NotYourTaskError;
        // Branch fetch is cached in core's read-through; failure => commission stays 0.
        let commissionBps = 0;
        try {
            const branch = await (0, branch_client_1.getBranch)(order.branchId);
            commissionBps = Number(branch.commissionBps ?? 0);
        }
        catch (err) {
            logger_1.logger.warn("settlement: branch fetch failed; commission set to 0", { publicId, error: err.message });
        }
        const commission = Math.floor((order.subtotal * commissionBps) / 10000);
        const earning = Math.floor((order.deliveryFee * env_1.env.delivery.agentEarningShareBps) / 10000);
        const trx = await conn.transaction();
        let updated;
        try {
            // Stamp commission FIRST so subsequent writes see the right number.
            await (0, order_repo_1.updateOrderCommission)(publicId, commission, trx);
            // For COD, write the charge transaction now (succeeded; the agent took the cash).
            if (order.paymentMethod === enums_1.PaymentMethod.COD) {
                await (0, transaction_repo_1.createTransactionIdempotent)({
                    region,
                    orderId: order.id,
                    transactionType: enums_2.TransactionType.COD_COLLECTION,
                    method: enums_2.TransactionMethod.COD,
                    providerId: null,
                    providerReferenceId: null,
                    status: enums_2.TransactionStatus.SUCCEEDED,
                    amount: order.total,
                    currency: order.currency,
                    srcAccId: order.customerId,
                    dstAccId: order.restaurantOwnerId,
                    idempotencyKey: `cod-collect:${order.publicId}`,
                }, trx);
            }
            // Commission: src=restaurant owner, dst=NULL (platform — no user record).
            if (commission > 0) {
                await (0, transaction_repo_1.createTransactionIdempotent)({
                    region,
                    orderId: order.id,
                    transactionType: enums_2.TransactionType.COMMISSION,
                    method: enums_2.TransactionMethod.SYSTEM,
                    providerId: null,
                    providerReferenceId: null,
                    status: enums_2.TransactionStatus.SUCCEEDED,
                    amount: commission,
                    currency: order.currency,
                    srcAccId: order.restaurantOwnerId,
                    dstAccId: null,
                    idempotencyKey: `commission:${order.publicId}`,
                }, trx);
            }
            // Service fee: customer paid it as part of `total`. For COD the
            // cod_collection above credits `total` to the restaurant owner;
            // the service fee is owed back to the platform. Book the
            // restaurant → platform transfer explicitly so finance reconciles.
            if (order.serviceFee > 0) {
                await (0, transaction_repo_1.createTransactionIdempotent)({
                    region,
                    orderId: order.id,
                    transactionType: enums_2.TransactionType.ADJUSTMENT,
                    method: enums_2.TransactionMethod.SYSTEM,
                    providerId: null,
                    providerReferenceId: null,
                    status: enums_2.TransactionStatus.SUCCEEDED,
                    amount: order.serviceFee,
                    currency: order.currency,
                    srcAccId: order.restaurantOwnerId,
                    dstAccId: null,
                    idempotencyKey: `service-fee:${order.publicId}`,
                }, trx);
            }
            // Delivery fee: same story — customer paid it inside `total`, it's
            // not the restaurant's money. Book restaurant → platform; the
            // agent's share is paid out separately via agent_earnings.
            if (order.deliveryFee > 0) {
                await (0, transaction_repo_1.createTransactionIdempotent)({
                    region,
                    orderId: order.id,
                    transactionType: enums_2.TransactionType.ADJUSTMENT,
                    method: enums_2.TransactionMethod.SYSTEM,
                    providerId: null,
                    providerReferenceId: null,
                    status: enums_2.TransactionStatus.SUCCEEDED,
                    amount: order.deliveryFee,
                    currency: order.currency,
                    srcAccId: order.restaurantOwnerId,
                    dstAccId: null,
                    idempotencyKey: `delivery-fee:${order.publicId}`,
                }, trx);
            }
            // Restaurant balance: net of commission.
            const netToRestaurant = order.subtotal - commission;
            if (netToRestaurant !== 0) {
                await (0, restaurant_balance_repo_1.upsertIncrement)({
                    restaurantId: order.restaurantId,
                    region,
                    currency: order.currency,
                    delta: netToRestaurant,
                }, trx);
            }
            // Agent earning. UNIQUE(order_id) makes this idempotent.
            await (0, agent_earning_repo_1.insertEarning)({
                region,
                agentId: order.deliveryAgentId,
                orderId: order.id,
                amount: earning,
                currency: order.currency,
            }, trx);
            // Finally flip status to delivered.
            updated = await (0, order_repo_1.updateOrderStatus)(publicId, enums_1.OrderStatus.DELIVERED, "delivered_at", trx);
            // Transactional outbox — order.delivered for analytics + future consumers.
            // Same trx so a publish never escapes a rolled-back settlement.
            await (0, outbox_repo_1.insertOutboxEvent)(trx, {
                aggregateType: "order",
                aggregateId: updated.publicId,
                eventType: event_types_1.EVENT_TYPES.ORDER_DELIVERED,
                payload: {
                    orderId: updated.publicId,
                    region: updated.region,
                    restaurantId: Number(updated.restaurantId),
                    branchId: Number(updated.branchId),
                    customerId: Number(updated.customerId),
                    deliveryAgentId: agentId,
                    total: updated.total,
                    subtotal: updated.subtotal,
                    deliveryFee: updated.deliveryFee,
                    commission,
                    currency: updated.currency,
                    paymentMethod: updated.paymentMethod,
                    deliveredAt: updated.deliveredAt?.toISOString() ?? new Date().toISOString(),
                },
            });
            await trx.commit();
        }
        catch (err) {
            await trx.rollback();
            throw err;
        }
        // After-commit Redis + WS — never publish state we then roll back.
        await this.presence.clearBusy(region, agentId);
        await this.cache.del(assignment_service_1.AssignmentService.claimKey(publicId));
        const statusDto = order_response_dto_1.OrderStatusResponseDTO.from(updated);
        this.io.to(`customer:${updated.customerId}`).emit("order.status_changed", statusDto);
        this.io.to(`branch:${updated.branchId}`).emit("order.status_changed", statusDto);
        return updated;
    }
};
exports.SettlementService = SettlementService;
exports.SettlementService = SettlementService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.PresenceService)),
    __param(1, (0, tsyringe_1.inject)(tokens_1.TOKENS.CacheProvider)),
    __metadata("design:paramtypes", [presence_service_1.PresenceService, Object])
], SettlementService);
