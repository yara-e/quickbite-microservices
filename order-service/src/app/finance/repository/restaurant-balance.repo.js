"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findByRestaurant = findByRestaurant;
exports.getForUpdate = getForUpdate;
exports.upsertIncrement = upsertIncrement;
exports.decrementIfSufficient = decrementIfSufficient;
const restaurant_balance_entity_1 = require("../entity/restaurant-balance.entity");
const COLUMNS = ["restaurant_id", "region", "currency", "balance", "updated_at"];
function toEntity(row) {
    return new restaurant_balance_entity_1.RestaurantBalanceEntity({
        restaurantId: Number(row.restaurant_id),
        region: row.region,
        currency: row.currency,
        balance: Number(row.balance),
        updatedAt: row.updated_at,
    });
}
async function findByRestaurant(restaurantId, conn) {
    const rows = await conn("restaurant_balances")
        .select(COLUMNS)
        .where({ restaurant_id: restaurantId });
    return rows.map(toEntity);
}
async function getForUpdate(restaurantId, currency, conn) {
    const row = await conn("restaurant_balances")
        .select(COLUMNS)
        .where({ restaurant_id: restaurantId, currency })
        .forUpdate()
        .first();
    return row ? toEntity(row) : undefined;
}
/**
 * UPSERT-with-increment. Atomic: if no row exists for (restaurant_id, currency)
 * the supplied delta is the initial balance; if one does, it's added. Used by
 * the `delivered` settlement trx.
 */
async function upsertIncrement(input, conn) {
    const [row] = await conn.raw(`INSERT INTO restaurant_balances (restaurant_id, region, currency, balance, updated_at)
         VALUES (?, ?, ?, ?, NOW())
         ON CONFLICT (restaurant_id, currency)
         DO UPDATE SET balance = restaurant_balances.balance + EXCLUDED.balance,
                       updated_at = NOW()
         RETURNING ${COLUMNS.join(",")}`, [input.restaurantId, input.region, input.currency, input.delta]).then((res) => res.rows ?? res);
    return toEntity(row);
}
/**
 * Decrement-with-floor. Used by recordPayout. Updates only when current
 * balance >= amount; returns undefined if it would go negative (caller
 * surfaces 409 InsufficientBalance).
 */
async function decrementIfSufficient(input, conn) {
    const [row] = await conn("restaurant_balances")
        .where({ restaurant_id: input.restaurantId, currency: input.currency })
        .where("balance", ">=", input.amount)
        .update({
        balance: conn.raw("balance - ?", [input.amount]),
        updated_at: conn.fn.now(),
    })
        .returning(COLUMNS);
    return row ? toEntity(row) : undefined;
}
