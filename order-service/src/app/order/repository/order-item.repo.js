"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDER_ITEM_COLUMNS = void 0;
exports.bulkInsertItems = bulkInsertItems;
exports.findItemsByOrderIds = findItemsByOrderIds;
exports.countItemsByOrderIds = countItemsByOrderIds;
const order_item_entity_1 = require("../entity/order-item.entity");
exports.ORDER_ITEM_COLUMNS = [
    "id",
    "region",
    "order_id",
    "product_id",
    "quantity",
    "unit_price_snapshot",
    "name_snapshot",
    "image_url_snapshot",
    "line_total",
    "created_at",
];
function toEntity(row) {
    return new order_item_entity_1.OrderItemEntity({
        id: Number(row.id),
        region: row.region,
        orderId: Number(row.order_id),
        productId: Number(row.product_id),
        quantity: Number(row.quantity),
        unitPriceSnapshot: Number(row.unit_price_snapshot),
        nameSnapshot: row.name_snapshot,
        imageUrlSnapshot: row.image_url_snapshot,
        lineTotal: Number(row.line_total),
        createdAt: row.created_at,
    });
}
async function bulkInsertItems(inputs, conn) {
    if (inputs.length === 0)
        return [];
    const rows = await conn("order_items")
        .insert(inputs.map((i) => ({
        region: i.region,
        order_id: i.orderId,
        product_id: i.productId,
        quantity: i.quantity,
        unit_price_snapshot: i.unitPriceSnapshot,
        name_snapshot: i.nameSnapshot,
        image_url_snapshot: i.imageUrlSnapshot,
        line_total: i.lineTotal,
    })))
        .returning(exports.ORDER_ITEM_COLUMNS);
    return rows.map(toEntity);
}
async function findItemsByOrderIds(orderIds, conn) {
    if (orderIds.length === 0)
        return [];
    const rows = await conn("order_items")
        .select(exports.ORDER_ITEM_COLUMNS)
        .whereIn("order_id", orderIds)
        .orderBy("id", "asc");
    return rows.map(toEntity);
}
async function countItemsByOrderIds(orderIds, conn) {
    const out = new Map();
    if (orderIds.length === 0)
        return out;
    const rows = await conn("order_items")
        .select("order_id")
        .count("* as count")
        .whereIn("order_id", orderIds)
        .groupBy("order_id");
    for (const r of rows)
        out.set(Number(r.order_id), Number(r.count));
    return out;
}
