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
exports.PaymentService = void 0;
const tsyringe_1 = require("tsyringe");
const tokens_1 = require("../../../lib/di/tokens");
const knex_1 = require("../../../lib/knex/knex");
const logger_1 = require("../../../lib/logger/logger");
const money_1 = require("../../../pkg/utils/money");
const time_1 = require("../../../pkg/utils/time");
const env_1 = require("../../../lib/config/env");
const errors_1 = require("../../../lib/auth/errors");
const payment_session_repo_1 = require("../repository/payment-session.repo");
const transaction_repo_1 = require("../repository/transaction.repo");
const enums_1 = require("../enums");
const payment_response_dto_1 = require("../dto/payment.response.dto");
const errors_2 = require("../errors");
let PaymentService = class PaymentService {
    kashier;
    constructor(kashier) {
        this.kashier = kashier;
    }
    /**
     * Called from OrderService.placeOrder for online orders, AFTER the order
     * row has been committed.
     *
     * Idempotent at the domain level: if an active session exists for this
     * order (initialized/pending), we return its redirectUrl rather than
     * minting a second one.
     */
    async initOnlinePayment(order) {
        const conn = (0, knex_1.db)(order.region);
        const sessionTtlMs = (0, time_1.toMs)(env_1.env.payments.sessionTimeoutMin, "m");
        const existing = await (0, payment_session_repo_1.findActiveSessionByOrderId)(order.id, conn);
        if (existing) {
            // Session already alive — surface it as-is. Kashier's iframe enforces its own expireAt.
            const expiresAt = new Date(existing.createdAt.getTime() + sessionTtlMs).toISOString();
            return {
                session: existing,
                expiresAt,
                dto: payment_response_dto_1.PaymentInitResponseDTO.from(existing, expiresAt),
            };
        }
        let providerResp;
        try {
            providerResp = await this.kashier.createSession({
                merchantOrderId: order.publicId,
                amount: (0, money_1.fromMinor)(order.total).toFixed(2),
                currency: order.currency,
                description: `QuickBite order ${order.publicId}`,
                allowedMethods: "card,wallet",
                customerReference: String(order.customerId),
            });
        }
        catch (err) {
            logger_1.logger.error("kashier createSession failed", {
                orderPublicId: order.publicId,
                error: err.message,
            });
            throw errors_2.PaymentProviderUnavailableError;
        }
        const session = await (0, payment_session_repo_1.createSession)({
            region: order.region,
            orderId: order.id,
            providerId: enums_1.PAYMENT_PROVIDER_IDS[enums_1.PaymentProviderName.KASHIER],
            providerSessionId: providerResp.providerSessionId,
            redirectUrl: providerResp.redirectUrl,
            amount: order.total,
            currency: order.currency,
            status: enums_1.PaymentSessionStatus.INITIALIZED,
            rawInitPayload: providerResp.rawResponse,
        }, conn);
        const expiresAt = providerResp.expiresAt
            ?? new Date(Date.now() + sessionTtlMs).toISOString();
        return {
            session,
            expiresAt,
            dto: payment_response_dto_1.PaymentInitResponseDTO.from(session, expiresAt),
        };
    }
    /**
     * GET /restaurants/:restaurantId/payments/:paymentId.
     *
     * Auth split between layers:
     *   - middleware (`requireRestaurantMember` + `rbac`) gates the request to
     *     members of the restaurant in the URL with `payments:read`;
     *     `system_admin` bypasses both.
     *   - this method just enforces "the payment actually belongs to that
     *     restaurant" so a member can't peek into a sibling restaurant by id.
     *
     * Single SQL via JOIN — no N+1.
     */
    async getById(paymentId, restaurantId, region) {
        const conn = (0, knex_1.db)(region);
        const found = await (0, transaction_repo_1.findTransactionWithRestaurant)(paymentId, conn);
        if (!found)
            throw errors_2.PaymentNotFoundError;
        if (found.restaurantId !== null && found.restaurantId !== restaurantId) {
            // The middleware verified the caller's right to see "restaurantId",
            // but the transaction belongs to a different restaurant.
            throw errors_1.UnAuthorisedError;
        }
        return payment_response_dto_1.PaymentResponseDTO.from(found.transaction);
    }
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.KashierProvider)),
    __metadata("design:paramtypes", [Object])
], PaymentService);
