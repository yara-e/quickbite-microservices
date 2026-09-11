"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceService = void 0;
const tsyringe_1 = require("tsyringe");
const knex_1 = require("../../../lib/knex/knex");
const restaurant_balance_repo_1 = require("../repository/restaurant-balance.repo");
const order_repo_1 = require("../../order/repository/order.repo");
const transaction_repo_1 = require("../../payment/repository/transaction.repo");
const enums_1 = require("../../payment/enums");
const finance_response_dto_1 = require("../dto/finance.response.dto");
const errors_1 = require("../errors");
let FinanceService = class FinanceService {
    async getBalance(restaurantId, region) {
        const conn = (0, knex_1.db)(region);
        const rows = await (0, restaurant_balance_repo_1.findByRestaurant)(restaurantId, conn);
        return finance_response_dto_1.RestaurantBalanceResponseDTO.from(restaurantId, rows);
    }
    async listPayouts(restaurantId, region, from, to, limit) {
        const conn = (0, knex_1.db)(region);
        const ownerId = await (0, order_repo_1.findOwnerIdForRestaurant)(restaurantId, conn);
        if (!ownerId)
            return [];
        const rows = await (0, transaction_repo_1.findPayouts)({ ownerId, from, to }, limit, conn);
        return rows.map(finance_response_dto_1.PayoutResponseDTO.from);
    }
    /**
     * Admin-only. Records an externally-completed bank transfer and decrements
     * the balance atomically. Idempotent on `idempotency_key` (set by the
     * idempotency middleware via the `Idempotency-Key` header).
     */
    async recordPayout(body, region, idempotencyKey) {
        const conn = (0, knex_1.db)(region);
        const ownerId = await (0, order_repo_1.findOwnerIdForRestaurant)(body.restaurantId, conn);
        if (!ownerId)
            throw errors_1.RestaurantNotFoundError;
        const trx = await conn.transaction();
        try {
            const decremented = await (0, restaurant_balance_repo_1.decrementIfSufficient)({ restaurantId: body.restaurantId, currency: body.currency, amount: body.amount }, trx);
            if (!decremented) {
                await trx.rollback();
                throw errors_1.InsufficientBalanceError;
            }
            const tx = await (0, transaction_repo_1.createTransaction)({
                region,
                orderId: null,
                transactionType: enums_1.TransactionType.PAYOUT,
                method: enums_1.TransactionMethod.BANK_TRANSFER,
                providerId: null,
                providerReferenceId: body.providerReferenceId,
                status: enums_1.TransactionStatus.SUCCEEDED,
                amount: body.amount,
                currency: body.currency,
                srcAccId: null, // platform → restaurant: no platform user record
                dstAccId: ownerId,
                idempotencyKey,
            }, trx);
            await trx.commit();
            return finance_response_dto_1.PayoutResponseDTO.from(tx);
        }
        catch (err) {
            // If trx is already rolled back (InsufficientBalance) this is a no-op.
            try {
                await trx.rollback();
            }
            catch { }
            throw err;
        }
    }
};
exports.FinanceService = FinanceService;
exports.FinanceService = FinanceService = __decorate([
    (0, tsyringe_1.injectable)()
], FinanceService);
