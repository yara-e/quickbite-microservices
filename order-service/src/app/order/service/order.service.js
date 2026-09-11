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
exports.OrderService = void 0;
const crypto_1 = require("crypto");
const tsyringe_1 = require("tsyringe");
const container_1 = require("../../../lib/di/container");
const tokens_1 = require("../../../lib/di/tokens");
const knex_1 = require("../../../lib/knex/knex");
const regions_1 = require("../../../lib/sharding/regions");
const logger_1 = require("../../../lib/logger/logger");
const errors_1 = require("../../../lib/auth/errors");
const money_1 = require("../../../pkg/utils/money");
const branch_client_1 = require("../../../lib/core-client/branch.client");
const address_client_1 = require("../../../lib/core-client/address.client");
const core_data_cache_service_1 = require("./core-data-cache.service");
const payment_service_1 = require("../../payment/service/payment.service");
const order_status_service_1 = require("./order-status.service");
const enums_1 = require("../enums");
const errors_2 = require("../errors");
const env_1 = require("../../../lib/config/env");
const order_response_dto_1 = require("../dto/order.response.dto");
const order_repo_1 = require("../repository/order.repo");
const order_item_repo_1 = require("../repository/order-item.repo");
const outbox_repo_1 = require("../../../lib/events/outbox.repo");
const event_types_1 = require("../../../lib/events/event-types");
const SERVICE_FEE_MINOR = 1000; // 10.00 EGP / SAR — paid to the platform.
const RESTAURANT_ORDERS_CACHE_PREFIX = (region, branchId) => `${region}:GET:/api/restaurant/orders?branchId=${branchId}`;
let OrderService = class OrderService {
    cache;
    coreData;
    paymentService;
    constructor(cache, coreData, paymentService) {
        this.cache = cache;
        this.coreData = coreData;
        this.paymentService = paymentService;
    }
    // Lazy access — WsServer is registered after the DI container builds the
    // routes (it depends on the http.Server, which is created in server.ts).
    get io() {
        return container_1.container.resolve(tokens_1.TOKENS.WsServer);
    }
    async placeOrder(actor, body, region, correlationId) {
        // 1. Branch metadata (drives shard region + accept flag + currency + delivery fee)
        const branch = await (0, branch_client_1.getBranch)(body.branchId, correlationId);
        if (!branch.isActive || !branch.acceptOrders)
            throw errors_2.BranchNotAcceptingOrdersError;
        if (branch.restaurantStatus !== "active")
            throw errors_2.BranchNotAcceptingOrdersError;
        if (await this.coreData.isBranchRejectingOrders(body.branchId))
            throw errors_2.BranchNotAcceptingOrdersError;
        // Branch country may arrive uppercase ("EG"); shard router is lowercase.
        const resolvedRegion = (0, regions_1.assertRegion)(region ?? branch.region);
        // Online gateway is enabled per-region (env-driven). Anything else falls
        // back to COD-only — fail fast before we touch stock.
        if (body.paymentMethod === enums_1.PaymentMethod.ONLINE && !env_1.env.payments.onlineRegions.has(resolvedRegion)) {
            throw errors_2.OnlinePaymentNotAvailableError;
        }
        // 2. Address (snapshot lat/lng + flat text)
        const address = await (0, address_client_1.getCustomerAddress)(body.customerAddressId, correlationId);
        if (Number(address.userId) !== Number(actor.userId))
            throw errors_1.UnAuthorisedError;
        // 3. Products (single batch)
        const productIds = body.items.map((i) => i.productId);
        const products = await (0, branch_client_1.getBranchProducts)(body.branchId, productIds, correlationId);
        const orderLineDrafts = this.buildOrderLineDrafts(body.items, products);
        // 4. Money
        const subtotal = (0, money_1.sumMinor)(orderLineDrafts.map((l) => l.lineTotal));
        const total = subtotal + branch.deliveryFee + SERVICE_FEE_MINOR;
        // 5. Reserve stock FIRST. If anything below this point fails, we MUST release.
        // Reserve is atomic on the core side (FOR UPDATE + 409 on underflow) so we
        // can't oversell. Using the publicId as the idempotency key means a retry
        // never double-reserves.
        const publicId = (0, crypto_1.randomUUID)();
        await (0, branch_client_1.reserveStock)(body.branchId, body.items.map((i) => ({ productId: i.productId, quantity: i.quantity })), publicId, correlationId);
        // 6. Trx on the branch's region
        const conn = (0, knex_1.db)(resolvedRegion);
        const trx = await conn.transaction();
        let order;
        let items;
        try {
            order = await (0, order_repo_1.createOrder)({
                region: resolvedRegion,
                publicId,
                countryCode: branch.region,
                restaurantId: Number(branch.restaurantId),
                restaurantOwnerId: Number(branch.restaurantOwnerId),
                branchId: Number(branch.id),
                customerId: actor.userId,
                customerAddressId: Number(address.id),
                deliveryLat: Number(address.lat),
                deliveryLng: Number(address.lng),
                deliveryAddressTextSnapshot: (0, address_client_1.flattenAddress)(address),
                branchLat: Number(branch.lat),
                branchLng: Number(branch.lng),
                status: body.paymentMethod === enums_1.PaymentMethod.ONLINE ? enums_1.OrderStatus.PENDING_PAYMENT : enums_1.OrderStatus.PLACED,
                subtotal,
                deliveryFee: branch.deliveryFee,
                serviceFee: SERVICE_FEE_MINOR,
                total,
                currency: branch.currency,
                paymentMethod: body.paymentMethod,
            }, trx);
            items = await (0, order_item_repo_1.bulkInsertItems)(orderLineDrafts.map((l) => ({
                region: resolvedRegion,
                orderId: order.id,
                productId: l.productId,
                quantity: l.quantity,
                unitPriceSnapshot: l.unitPrice,
                nameSnapshot: l.name,
                imageUrlSnapshot: l.imageUrl,
                lineTotal: l.lineTotal,
            })), trx);
            // Transactional outbox — only COD lands as `placed` here.
            // ONLINE orders start as `pending_payment` and emit `order.placed`
            // from the Kashier webhook after capture (see kashier-webhook.service.ts).
            if (order.status === enums_1.OrderStatus.PLACED) {
                await (0, outbox_repo_1.insertOutboxEvent)(trx, {
                    aggregateType: "order",
                    aggregateId: order.publicId,
                    eventType: event_types_1.EVENT_TYPES.ORDER_PLACED,
                    payload: buildOrderPlacedPayload(order, items),
                });
            }
            await trx.commit();
        }
        catch (err) {
            await trx.rollback();
            await this.releaseStockSafe(body.branchId, body.items, publicId, correlationId);
            throw err;
        }
        // 7. Online → init Kashier session. Rollback on failure (void order +
        // release stock) so the customer is never stranded.
        let paymentInfo;
        if (body.paymentMethod === enums_1.PaymentMethod.ONLINE) {
            try {
                const result = await this.paymentService.initOnlinePayment(order);
                paymentInfo = {
                    sessionId: result.dto.sessionId,
                    providerSessionId: result.dto.providerSessionId,
                    redirectUrl: result.dto.redirectUrl,
                    expiresAt: result.dto.expiresAt,
                };
            }
            catch (err) {
                logger_1.logger.warn("payment init failed; voiding order", { publicId: order.publicId, error: err.message });
                await this.voidOrderSafe(resolvedRegion, order.publicId);
                await this.releaseStockSafe(body.branchId, body.items, order.publicId, correlationId);
                throw err;
            }
        }
        // 8. Cache + WS
        await this.invalidateBranchOrdersCache(resolvedRegion, branch.id);
        if (body.paymentMethod === enums_1.PaymentMethod.COD) {
            this.io
                .to(`branch:${branch.id}`)
                .emit("order.created", order_response_dto_1.OrderSummaryResponseDTO.from(order, items.length));
        }
        return order_response_dto_1.OrderResponseDTO.from(order, items, paymentInfo);
    }
    async voidOrderSafe(region, publicId) {
        try {
            const trx = await (0, knex_1.db)(region).transaction();
            try {
                await (0, order_repo_1.updateOrderStatus)(publicId, enums_1.OrderStatus.CANCELLED, "cancelled_at", trx);
                await trx.commit();
            }
            catch (e) {
                await trx.rollback();
                throw e;
            }
        }
        catch (err) {
            logger_1.logger.error("voidOrderSafe failed (order remains in pending_payment)", { publicId, error: err.message });
        }
    }
    async getOrder(actor, region, publicId) {
        const conn = (0, knex_1.db)(region);
        const order = await (0, order_repo_1.findOrderByPublicId)(publicId, conn);
        if (!order)
            throw errors_2.OrderNotFoundError;
        this.assertReadAccess(actor, order);
        const items = await (0, order_item_repo_1.findItemsByOrderIds)([order.id], conn);
        return order_response_dto_1.OrderDetailResponseDTO.from(order, items);
    }
    async listCustomerOrders(actor, region, year, pagination) {
        const yearStart = new Date(Date.UTC(year, 0, 1));
        const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
        const conn = (0, knex_1.db)(region);
        const result = await (0, order_repo_1.findOrdersByCustomer)({ customerId: actor.userId, yearStart, yearEnd }, pagination, conn);
        const counts = await (0, order_item_repo_1.countItemsByOrderIds)(result.data.map((o) => o.id), conn);
        return {
            data: result.data.map((o) => order_response_dto_1.OrderSummaryResponseDTO.from(o, counts.get(o.id) ?? 0)),
            meta: result.meta,
        };
    }
    async listRestaurantOrders(_actor, region, restaurantId, branchId, status, from, to, filters, pagination) {
        const conn = (0, knex_1.db)(region);
        const result = await (0, order_repo_1.findOrdersByRestaurantBranch)({ restaurantId, branchId, status, from, to }, pagination, filters, conn);
        const counts = await (0, order_item_repo_1.countItemsByOrderIds)(result.data.map((o) => o.id), conn);
        return {
            data: result.data.map((o) => order_response_dto_1.OrderSummaryResponseDTO.from(o, counts.get(o.id) ?? 0)),
            meta: result.meta,
        };
    }
    async updateStatus(actor, region, publicId, body) {
        const conn = (0, knex_1.db)(region);
        const order = await (0, order_repo_1.findOrderByPublicId)(publicId, conn);
        if (!order)
            throw errors_2.OrderNotFoundError;
        const statusActor = this.resolveStatusActor(actor, order);
        const { stamp } = (0, order_status_service_1.assertTransition)(order.status, body.status, {
            actor: statusActor,
            reason: body.reason,
            placedAt: order.createdAt,
            acceptedAt: order.acceptedAt,
        });
        const trx = await conn.transaction();
        let updated;
        try {
            updated = await (0, order_repo_1.updateOrderStatus)(order.publicId, body.status, stamp, trx);
            // Transactional outbox — pick the matching event type for the
            // new status. Same trx as the status update so we can't publish
            // a state we then roll back.
            const eventType = OUTBOX_EVENT_FOR_STATUS[body.status];
            if (eventType) {
                await (0, outbox_repo_1.insertOutboxEvent)(trx, {
                    aggregateType: "order",
                    aggregateId: updated.publicId,
                    eventType,
                    payload: buildOrderTransitionPayload(updated, body.reason, statusActor),
                });
            }
            await trx.commit();
        }
        catch (err) {
            await trx.rollback();
            throw err;
        }
        await this.invalidateBranchOrdersCache(region, order.branchId);
        const payload = order_response_dto_1.OrderStatusResponseDTO.from(updated);
        this.io.to(`customer:${updated.customerId}`).emit("order.status_changed", payload);
        this.io.to(`branch:${updated.branchId}`).emit("order.status_changed", payload);
        return payload;
    }
    // ── private helpers ──────────────────────────────────────────────────
    buildOrderLineDrafts(requested, products) {
        const byProduct = new Map();
        for (const p of products)
            byProduct.set(Number(p.productId), p);
        const unavailableItems = [];
        const drafts = [];
        for (const it of requested) {
            const p = byProduct.get(it.productId);
            if (!p || !p.isAvailable) {
                unavailableItems.push({ productId: it.productId, requested: it.quantity, available: 0 });
                continue;
            }
            if (p.stock < it.quantity) {
                unavailableItems.push({ productId: it.productId, requested: it.quantity, available: p.stock });
                continue;
            }
            drafts.push({
                productId: it.productId,
                quantity: it.quantity,
                unitPrice: p.price,
                lineTotal: (0, money_1.multiplyMinor)(p.price, it.quantity),
                name: p.name,
                imageUrl: p.imageUrl,
            });
        }
        if (unavailableItems.length > 0)
            throw (0, errors_2.outOfStockError)(unavailableItems);
        return drafts;
    }
    async releaseStockSafe(branchId, items, idempotencyKey, correlationId) {
        try {
            await (0, branch_client_1.releaseStock)(branchId, items, idempotencyKey, correlationId);
        }
        catch (err) {
            // Log loudly but do not mask the original error; release-stock failure
            // is observability/alerting territory, not a customer-facing error.
            logger_1.logger.error("releaseStock failed after order placement rollback", {
                branchId,
                error: err.message,
            });
        }
    }
    assertReadAccess(actor, order) {
        if (actor.role === "system_admin")
            return;
        if (Number(actor.userId) === Number(order.customerId))
            return;
        if (actor.role === "restaurant_user") {
            if (Number(actor.restaurantId) !== Number(order.restaurantId))
                throw errors_1.UnAuthorisedError;
            if (actor.restaurantRole === "owner")
                return;
            const branchIds = actor.branchIds ?? [];
            if (branchIds.includes(Number(order.branchId)))
                return;
        }
        throw errors_1.UnAuthorisedError;
    }
    resolveStatusActor(actor, order) {
        if (actor.role === "system_admin")
            return enums_1.StatusActor.ADMIN;
        if (actor.role === "delivery_agent" && Number(actor.userId) === Number(order.deliveryAgentId))
            return enums_1.StatusActor.AGENT;
        if (actor.role === "restaurant_user") {
            if (Number(actor.restaurantId) !== Number(order.restaurantId))
                throw errors_1.UnAuthorisedError;
            if (actor.restaurantRole !== "owner") {
                const branchIds = actor.branchIds ?? [];
                if (!branchIds.includes(Number(order.branchId)))
                    throw errors_1.UnAuthorisedError;
            }
            return enums_1.StatusActor.RESTAURANT_MEMBER;
        }
        if (Number(actor.userId) === Number(order.customerId))
            return enums_1.StatusActor.CUSTOMER;
        throw errors_1.UnAuthorisedError;
    }
    async invalidateBranchOrdersCache(region, branchId) {
        try {
            await this.cache.del(RESTAURANT_ORDERS_CACHE_PREFIX(region, branchId));
        }
        catch { }
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.CacheProvider)),
    __param(1, (0, tsyringe_1.inject)(tokens_1.TOKENS.CoreDataCacheService)),
    __param(2, (0, tsyringe_1.inject)(tokens_1.TOKENS.PaymentService)),
    __metadata("design:paramtypes", [Object, core_data_cache_service_1.CoreDataCacheService,
        payment_service_1.PaymentService])
], OrderService);
// ─── Outbox payload builders ─────────────────────────────────────────────────
// Kept as module-level helpers (not class methods) so they're easy to unit-test
// in isolation and don't drag a `this` context into the trx callback.
const OUTBOX_EVENT_FOR_STATUS = {
    [enums_1.OrderStatus.ACCEPTED]: event_types_1.EVENT_TYPES.ORDER_ACCEPTED,
    [enums_1.OrderStatus.REJECTED]: event_types_1.EVENT_TYPES.ORDER_REJECTED,
    [enums_1.OrderStatus.CANCELLED]: event_types_1.EVENT_TYPES.ORDER_CANCELLED,
};
/** Matches analytics-service contract (docs/api-contracts.md — order.placed payload). */
function buildOrderPlacedPayload(order, items) {
    return {
        orderId: order.publicId,
        region: order.region,
        countryCode: order.countryCode,
        restaurantId: Number(order.restaurantId),
        branchId: Number(order.branchId),
        customerId: Number(order.customerId),
        status: order.status,
        paymentMethod: order.paymentMethod,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        serviceFee: order.serviceFee,
        total: order.total,
        currency: order.currency,
        items: items.map((i) => ({
            productId: Number(i.productId),
            quantity: i.quantity,
            unitPrice: i.unitPriceSnapshot,
            lineTotal: i.lineTotal,
        })),
        placedAt: order.createdAt.toISOString(),
    };
}
function buildOrderTransitionPayload(order, reason, actor) {
    return {
        orderId: order.publicId,
        region: order.region,
        restaurantId: Number(order.restaurantId),
        branchId: Number(order.branchId),
        customerId: Number(order.customerId),
        status: order.status,
        reason: reason ?? null,
        actor,
        occurredAt: order.updatedAt.toISOString(),
    };
}
