"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSACTION_COLUMNS = void 0;
exports.createTransaction = createTransaction;
exports.createTransactionIdempotent = createTransactionIdempotent;
exports.findTransactionById = findTransactionById;
exports.findTransactionWithRestaurant = findTransactionWithRestaurant;
exports.findTransactionByIdempotencyKey = findTransactionByIdempotencyKey;
exports.findPayouts = findPayouts;
exports.findTransactionsByOrderIds = findTransactionsByOrderIds;
const transaction_entity_1 = require("../entity/transaction.entity");
exports.TRANSACTION_COLUMNS = [
    "id",
    "region",
    "order_id",
    "transaction_type",
    "method",
    "provider_id",
    "provider_reference_id",
    "status",
    "amount",
    "currency",
    "src_acc_id",
    "dst_acc_id",
    "is_refunded",
    "refunded_payment_id",
    "idempotency_key",
    "created_at",
    "updated_at",
];
function toEntity(row) {
    return new transaction_entity_1.TransactionEntity({
        id: Number(row.id),
        region: row.region,
        orderId: row.order_id !== null && row.order_id !== undefined ? Number(row.order_id) : null,
        transactionType: row.transaction_type,
        method: row.method,
        providerId: row.provider_id !== null && row.provider_id !== undefined ? Number(row.provider_id) : null,
        providerReferenceId: row.provider_reference_id,
        status: row.status,
        amount: Number(row.amount),
        currency: row.currency,
        srcAccId: row.src_acc_id !== null && row.src_acc_id !== undefined ? Number(row.src_acc_id) : null,
        dstAccId: row.dst_acc_id !== null && row.dst_acc_id !== undefined ? Number(row.dst_acc_id) : null,
        isRefunded: !!row.is_refunded,
        refundedPaymentId: row.refunded_payment_id !== null && row.refunded_payment_id !== undefined ? Number(row.refunded_payment_id) : null,
        idempotencyKey: row.idempotency_key,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}
async function createTransaction(input, conn) {
    const [row] = await conn("transactions")
        .insert({
        region: input.region,
        order_id: input.orderId,
        transaction_type: input.transactionType,
        method: input.method,
        provider_id: input.providerId,
        provider_reference_id: input.providerReferenceId,
        status: input.status,
        amount: input.amount,
        currency: input.currency,
        src_acc_id: input.srcAccId,
        dst_acc_id: input.dstAccId,
        idempotency_key: input.idempotencyKey,
    })
        .returning(exports.TRANSACTION_COLUMNS);
    return toEntity(row);
}
/**
 * Idempotent insert keyed off `idempotency_key`. Returns the inserted row, or
 * `undefined` if a row with that key already existed (the caller can then
 * decide to treat that as success without doing the side-effects again).
 *
 * Used for: commission and cod_collection writes during the `delivered`
 * settlement trx, so a re-run never double-charges/-credits.
 */
async function createTransactionIdempotent(input, conn) {
    const rows = await conn("transactions")
        .insert({
        region: input.region,
        order_id: input.orderId,
        transaction_type: input.transactionType,
        method: input.method,
        provider_id: input.providerId,
        provider_reference_id: input.providerReferenceId,
        status: input.status,
        amount: input.amount,
        currency: input.currency,
        src_acc_id: input.srcAccId,
        dst_acc_id: input.dstAccId,
        idempotency_key: input.idempotencyKey,
    })
        .onConflict("idempotency_key")
        .ignore()
        .returning(exports.TRANSACTION_COLUMNS);
    if (rows.length === 0)
        return undefined;
    return toEntity(rows[0]);
}
async function findTransactionById(id, conn) {
    const row = await conn("transactions")
        .select(exports.TRANSACTION_COLUMNS)
        .where({ id })
        .first();
    return row ? toEntity(row) : undefined;
}
/**
 * Single round-trip: load the transaction and its order's restaurant_id so
 * the controller-level requireRestaurantMember middleware can be paired with
 * a service-level "this payment really belongs to that restaurant" check
 * without a second SQL.
 */
async function findTransactionWithRestaurant(id, conn) {
    const row = await conn("transactions as t")
        .leftJoin("orders as o", "o.id", "t.order_id")
        .select([
        ...exports.TRANSACTION_COLUMNS.map((c) => `t.${c} as ${c}`),
        "o.restaurant_id as _restaurant_id",
    ])
        .where("t.id", id)
        .first();
    if (!row)
        return undefined;
    return {
        transaction: toEntity(row),
        restaurantId: row._restaurant_id !== null && row._restaurant_id !== undefined ? Number(row._restaurant_id) : null,
    };
}
async function findTransactionByIdempotencyKey(key, conn) {
    const row = await conn("transactions")
        .select(exports.TRANSACTION_COLUMNS)
        .where({ idempotency_key: key })
        .first();
    return row ? toEntity(row) : undefined;
}
async function findPayouts(filter, limit, conn) {
    const rows = await conn("transactions")
        .select(exports.TRANSACTION_COLUMNS)
        .where("transaction_type", "payout")
        .where("dst_acc_id", filter.ownerId)
        .where("created_at", ">=", filter.from)
        .where("created_at", "<", filter.to)
        .orderBy("created_at", "desc")
        .limit(limit);
    return rows.map(toEntity);
}
async function findTransactionsByOrderIds(orderIds, conn) {
    if (orderIds.length === 0)
        return [];
    const rows = await conn("transactions")
        .select(exports.TRANSACTION_COLUMNS)
        .whereIn("order_id", orderIds)
        .orderBy("id", "asc");
    return rows.map(toEntity);
}
