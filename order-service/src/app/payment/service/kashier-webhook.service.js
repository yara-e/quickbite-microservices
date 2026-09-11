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
exports.KashierWebhookService = void 0;
const tsyringe_1 = require("tsyringe");
const container_1 = require("../../../lib/di/container");
const tokens_1 = require("../../../lib/di/tokens");
const knex_1 = require("../../../lib/knex/knex");
const logger_1 = require("../../../lib/logger/logger");
const enums_1 = require("../../order/enums");
const order_repo_1 = require("../../order/repository/order.repo");
const order_item_repo_1 = require("../../order/repository/order-item.repo");
const order_response_dto_1 = require("../../order/dto/order.response.dto");
const payment_session_repo_1 = require("../repository/payment-session.repo");
const transaction_repo_1 = require("../repository/transaction.repo");
const payment_webhook_event_repo_1 = require("../repository/payment-webhook-event.repo");
const enums_2 = require("../enums");
const errors_1 = require("../errors");
const outbox_repo_1 = require("../../../lib/events/outbox.repo");
const event_types_1 = require("../../../lib/events/event-types");
const KASHIER_PROVIDER_ID = enums_2.PAYMENT_PROVIDER_IDS[enums_2.PaymentProviderName.KASHIER];
let KashierWebhookService = class KashierWebhookService {
    kashier;
    constructor(kashier) {
        this.kashier = kashier;
    }
    get io() {
        return container_1.container.resolve(tokens_1.TOKENS.WsServer);
    }
    /**
     * Top-level entry from WebhookController. Always returns void on success
     * — caller responds 200. Throws AppError on signature failure / malformed
     * payload (caller surfaces 401 / 400 respectively). Internal exceptions
     * during reconciliation are stamped as `process_error` and re-thrown so
     * Kashier retries.
     */
    async processKashierWebhook(rawBody, signatureHeader, region) {
        const envelope = parseEnvelope(rawBody);
        if (!signatureHeader)
            throw errors_1.InvalidWebhookSignatureError;
        const ok = this.kashier.verifyWebhook({
            payload: envelope.data,
            signatureKeys: envelope.data.signatureKeys ?? [],
            signature: signatureHeader,
        });
        if (!ok)
            throw errors_1.InvalidWebhookSignatureError;
        const conn = (0, knex_1.db)(region);
        // De-dupe at the SQL boundary. transactionId is stable across Kashier retries.
        const recorded = await (0, payment_webhook_event_repo_1.recordWebhookOrSkip)({
            region,
            providerId: KASHIER_PROVIDER_ID,
            providerEventId: envelope.data.transactionId,
            signature: signatureHeader,
            payload: envelope,
        }, conn);
        if (!recorded) {
            logger_1.logger.info("kashier webhook duplicate, skipping", { transactionId: envelope.data.transactionId });
            return;
        }
        try {
            await this.reconcile(envelope, region);
            await (0, payment_webhook_event_repo_1.markWebhookProcessed)(recorded.id, null, conn);
        }
        catch (err) {
            const msg = err.message ?? String(err);
            logger_1.logger.error("kashier webhook reconciliation failed", { transactionId: envelope.data.transactionId, error: msg });
            await (0, payment_webhook_event_repo_1.markWebhookProcessed)(recorded.id, msg, conn);
            throw err;
        }
    }
    async reconcile(envelope, region) {
        // We only handle 'pay' events in Phase 2. 'refund' is student homework;
        // 'authorize' / 'void' / 'capture' are out of scope today.
        if (envelope.event !== "pay") {
            logger_1.logger.info("kashier webhook event ignored", { event: envelope.event });
            return;
        }
        const conn = (0, knex_1.db)(region);
        const order = await (0, order_repo_1.findOrderByPublicId)(envelope.data.merchantOrderId, conn);
        if (!order) {
            logger_1.logger.warn("kashier webhook for unknown order", { merchantOrderId: envelope.data.merchantOrderId });
            return;
        }
        // The webhook's `kashierOrderId` is a transaction-level Kashier id, NOT
        // the session `_id` we stored as `provider_session_id`. So we resolve
        // the session via the order: latest active session for this order.
        const session = await (0, payment_session_repo_1.findActiveSessionByOrderId)(order.id, conn);
        if (!session) {
            logger_1.logger.warn("kashier webhook with no active session for order", {
                merchantOrderId: envelope.data.merchantOrderId,
                kashierOrderId: envelope.data.kashierOrderId,
            });
            return;
        }
        const trx = await conn.transaction();
        try {
            if (envelope.data.status === "SUCCESS") {
                await (0, payment_session_repo_1.updateSession)(session.id, {
                    status: enums_2.PaymentSessionStatus.CAPTURED,
                    rawLastPayload: envelope,
                }, trx);
                await (0, transaction_repo_1.createTransaction)({
                    region,
                    orderId: order.id,
                    transactionType: enums_2.TransactionType.CHARGE,
                    method: enums_2.TransactionMethod.ONLINE,
                    providerId: KASHIER_PROVIDER_ID,
                    providerReferenceId: envelope.data.transactionId,
                    status: enums_2.TransactionStatus.SUCCEEDED,
                    amount: session.amount,
                    currency: session.currency,
                    srcAccId: order.customerId,
                    dstAccId: order.restaurantOwnerId,
                    idempotencyKey: `kashier:${envelope.data.transactionId}`,
                }, trx);
                // payment.completed — fired for both `pending_payment → placed`
                // captures and for any out-of-band capture events. In-trx.
                await (0, outbox_repo_1.insertOutboxEvent)(trx, {
                    aggregateType: "payment",
                    aggregateId: order.publicId,
                    eventType: event_types_1.EVENT_TYPES.PAYMENT_COMPLETED,
                    payload: {
                        orderId: order.publicId,
                        region,
                        restaurantId: Number(order.restaurantId),
                        branchId: Number(order.branchId),
                        customerId: Number(order.customerId),
                        provider: "kashier",
                        providerReferenceId: envelope.data.transactionId,
                        amount: session.amount,
                        currency: session.currency,
                        method: "online",
                        completedAt: new Date().toISOString(),
                    },
                });
                if (order.status === enums_1.OrderStatus.PENDING_PAYMENT) {
                    const placed = await (0, order_repo_1.updateOrderStatus)(order.publicId, enums_1.OrderStatus.PLACED, null, trx);
                    // Now the order is officially placed — emit order.placed
                    // for the analytics contract, items snapshot in the same trx.
                    const items = await (0, order_item_repo_1.findItemsByOrderIds)([placed.id], trx);
                    await (0, outbox_repo_1.insertOutboxEvent)(trx, {
                        aggregateType: "order",
                        aggregateId: placed.publicId,
                        eventType: event_types_1.EVENT_TYPES.ORDER_PLACED,
                        payload: {
                            orderId: placed.publicId,
                            region: placed.region,
                            countryCode: placed.countryCode,
                            restaurantId: Number(placed.restaurantId),
                            branchId: Number(placed.branchId),
                            customerId: Number(placed.customerId),
                            status: placed.status,
                            paymentMethod: placed.paymentMethod,
                            subtotal: placed.subtotal,
                            deliveryFee: placed.deliveryFee,
                            serviceFee: placed.serviceFee,
                            total: placed.total,
                            currency: placed.currency,
                            items: items.map((i) => ({
                                productId: Number(i.productId),
                                quantity: i.quantity,
                                unitPrice: i.unitPriceSnapshot,
                                lineTotal: i.lineTotal,
                            })),
                            placedAt: placed.createdAt.toISOString(),
                        },
                    });
                    await trx.commit();
                    // WS announcements after commit so we never publish a state we then roll back.
                    this.io.to(`branch:${placed.branchId}`).emit("order.created", order_response_dto_1.OrderSummaryResponseDTO.from(placed, items.length));
                    this.io.to(`customer:${placed.customerId}`).emit("order.status_changed", order_response_dto_1.OrderStatusResponseDTO.from(placed));
                    return;
                }
                await trx.commit();
                return;
            }
            // FAILED branch — record the failed charge for audit, leave order in pending_payment.
            await (0, payment_session_repo_1.updateSession)(session.id, {
                status: enums_2.PaymentSessionStatus.FAILED,
                rawLastPayload: envelope,
            }, trx);
            await (0, transaction_repo_1.createTransaction)({
                region,
                orderId: order.id,
                transactionType: enums_2.TransactionType.CHARGE,
                method: enums_2.TransactionMethod.ONLINE,
                providerId: KASHIER_PROVIDER_ID,
                providerReferenceId: envelope.data.transactionId,
                status: enums_2.TransactionStatus.FAILED,
                amount: session.amount,
                currency: session.currency,
                srcAccId: order.customerId,
                dstAccId: null,
                idempotencyKey: `kashier:${envelope.data.transactionId}`,
            }, trx);
            await (0, outbox_repo_1.insertOutboxEvent)(trx, {
                aggregateType: "payment",
                aggregateId: order.publicId,
                eventType: event_types_1.EVENT_TYPES.PAYMENT_FAILED,
                payload: {
                    orderId: order.publicId,
                    region,
                    restaurantId: Number(order.restaurantId),
                    branchId: Number(order.branchId),
                    customerId: Number(order.customerId),
                    provider: "kashier",
                    providerReferenceId: envelope.data.transactionId,
                    amount: session.amount,
                    currency: session.currency,
                    method: "online",
                    failedAt: new Date().toISOString(),
                },
            });
            await trx.commit();
        }
        catch (err) {
            await trx.rollback();
            throw err;
        }
    }
};
exports.KashierWebhookService = KashierWebhookService;
exports.KashierWebhookService = KashierWebhookService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.KashierProvider)),
    __metadata("design:paramtypes", [Object])
], KashierWebhookService);
function parseEnvelope(rawBody) {
    let parsed;
    try {
        parsed = JSON.parse(rawBody.toString("utf8"));
    }
    catch {
        throw errors_1.MalformedWebhookError;
    }
    if (!parsed?.event || !parsed?.data?.transactionId || !Array.isArray(parsed?.data?.signatureKeys)) {
        throw errors_1.MalformedWebhookError;
    }
    return parsed;
}
