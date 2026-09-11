"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDER_COLUMNS = void 0;
exports.createOrder = createOrder;
exports.findOwnerIdForRestaurant = findOwnerIdForRestaurant;
exports.findOrderByPublicId = findOrderByPublicId;
exports.findReadyUnassigned = findReadyUnassigned;
exports.claimReadyOrderForAgent = claimReadyOrderForAgent;
exports.releaseAssignedOrderToReady = releaseAssignedOrderToReady;
exports.findAgentTasks = findAgentTasks;
exports.updateOrderCommission = updateOrderCommission;
exports.updateOrderStatus = updateOrderStatus;
exports.findOrdersByCustomer = findOrdersByCustomer;
exports.findOrdersByRestaurantBranch = findOrdersByRestaurantBranch;
const order_entity_1 = require("../entity/order.entity");
const cursor_pagination_1 = require("../../../lib/http/pagination/cursor-pagination");
exports.ORDER_COLUMNS = [
    "id",
    "region",
    "public_id",
    "country_code",
    "restaurant_id",
    "restaurant_owner_id",
    "branch_id",
    "customer_id",
    "customer_address_id",
    "delivery_lat",
    "delivery_lng",
    "delivery_address_text_snapshot",
    "branch_lat",
    "branch_lng",
    "status",
    "subtotal",
    "delivery_fee",
    "service_fee",
    "total",
    "commission",
    "currency",
    "payment_method",
    "delivery_agent_id",
    "created_at",
    "updated_at",
    "accepted_at",
    "rejected_at",
    "ready_at",
    "assigned_at",
    "picked_at",
    "delivered_at",
    "cancelled_at",
];
function toEntity(row) {
    return new order_entity_1.OrderEntity({
        id: Number(row.id),
        region: row.region,
        publicId: row.public_id,
        countryCode: row.country_code,
        restaurantId: Number(row.restaurant_id),
        restaurantOwnerId: Number(row.restaurant_owner_id),
        branchId: Number(row.branch_id),
        customerId: Number(row.customer_id),
        customerAddressId: Number(row.customer_address_id),
        deliveryLat: Number(row.delivery_lat),
        deliveryLng: Number(row.delivery_lng),
        deliveryAddressTextSnapshot: row.delivery_address_text_snapshot,
        branchLat: Number(row.branch_lat),
        branchLng: Number(row.branch_lng),
        status: row.status,
        subtotal: Number(row.subtotal),
        deliveryFee: Number(row.delivery_fee),
        serviceFee: Number(row.service_fee),
        total: Number(row.total),
        commission: Number(row.commission),
        currency: row.currency,
        paymentMethod: row.payment_method,
        deliveryAgentId: row.delivery_agent_id !== null && row.delivery_agent_id !== undefined ? Number(row.delivery_agent_id) : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        acceptedAt: row.accepted_at,
        rejectedAt: row.rejected_at,
        readyAt: row.ready_at,
        assignedAt: row.assigned_at,
        pickedAt: row.picked_at,
        deliveredAt: row.delivered_at,
        cancelledAt: row.cancelled_at,
    });
}
async function createOrder(input, conn) {
    const [row] = await conn("orders")
        .insert({
        region: input.region,
        public_id: input.publicId,
        country_code: input.countryCode,
        restaurant_id: input.restaurantId,
        restaurant_owner_id: input.restaurantOwnerId,
        branch_id: input.branchId,
        customer_id: input.customerId,
        customer_address_id: input.customerAddressId,
        delivery_lat: input.deliveryLat,
        delivery_lng: input.deliveryLng,
        delivery_address_text_snapshot: input.deliveryAddressTextSnapshot,
        branch_lat: input.branchLat,
        branch_lng: input.branchLng,
        status: input.status,
        subtotal: input.subtotal,
        delivery_fee: input.deliveryFee,
        service_fee: input.serviceFee,
        total: input.total,
        commission: 0,
        currency: input.currency,
        payment_method: input.paymentMethod,
    })
        .returning(exports.ORDER_COLUMNS);
    return toEntity(row);
}
/**
 * Cheap lookup used by the finance module to resolve the restaurant's owner id
 * from any past order on this shard (we snapshot `restaurant_owner_id` on every
 * order, so the latest order is always authoritative). Returns undefined if the
 * restaurant has no orders yet — the caller should surface a 409 (no balance).
 */
async function findOwnerIdForRestaurant(restaurantId, conn) {
    const row = await conn("orders")
        .select("restaurant_owner_id")
        .where({ restaurant_id: restaurantId })
        .orderBy("created_at", "desc")
        .first();
    return row ? Number(row.restaurant_owner_id) : undefined;
}
async function findOrderByPublicId(publicId, conn) {
    const row = await conn("orders").select(exports.ORDER_COLUMNS).where({ public_id: publicId }).first();
    return row ? toEntity(row) : undefined;
}
/**
 * Returns the oldest READY orders that don't yet have a delivery agent.
 * Backed by `idx_orders_status_created_at` (partial WHERE status IN ('ready','assigned')).
 */
async function findReadyUnassigned(limit, conn) {
    const rows = await conn("orders")
        .select(exports.ORDER_COLUMNS)
        .where("status", "ready")
        .whereNull("delivery_agent_id")
        .orderBy("created_at", "asc")
        .limit(limit);
    return rows.map(toEntity);
}
/**
 * Conditional claim — moves the order from ready to assigned and stamps the
 * agent + assigned_at, but ONLY if the row is still ready and unassigned.
 * Returns the updated entity on success, undefined if the conditions weren't
 * met (another claim won the race; assignment.service rolls back).
 */
async function claimReadyOrderForAgent(publicId, agentId, conn) {
    const [row] = await conn("orders")
        .where({ public_id: publicId, status: "ready" })
        .whereNull("delivery_agent_id")
        .update({
        status: "assigned",
        delivery_agent_id: agentId,
        assigned_at: conn.fn.now(),
        updated_at: conn.fn.now(),
    })
        .returning(exports.ORDER_COLUMNS);
    return row ? toEntity(row) : undefined;
}
/**
 * Resets a claimed order back to ready (used when an `assigned` agent goes
 * offline). Conditional on status='assigned' so we never clobber a `picked`.
 */
async function releaseAssignedOrderToReady(agentId, conn) {
    const updated = await conn("orders")
        .where({ delivery_agent_id: agentId, status: "assigned" })
        .update({
        status: "ready",
        delivery_agent_id: null,
        assigned_at: null,
        updated_at: conn.fn.now(),
    });
    return updated;
}
async function findAgentTasks(agentId, statuses, limit, conn) {
    let q = conn("orders")
        .select(exports.ORDER_COLUMNS)
        .where("delivery_agent_id", agentId);
    if (statuses && statuses.length > 0)
        q = q.whereIn("status", statuses);
    const rows = await q.orderBy("assigned_at", "desc").limit(limit);
    return rows.map(toEntity);
}
async function updateOrderCommission(publicId, commission, conn) {
    await conn("orders").where({ public_id: publicId }).update({ commission, updated_at: conn.fn.now() });
}
async function updateOrderStatus(publicId, status, stampColumn, conn) {
    const update = {
        status,
        updated_at: conn.fn.now(),
    };
    if (stampColumn) {
        update[stampColumn] = conn.fn.now();
    }
    const [row] = await conn("orders")
        .where({ public_id: publicId })
        .update(update)
        .returning(exports.ORDER_COLUMNS);
    return toEntity(row);
}
async function findOrdersByCustomer(filter, pagination, conn) {
    const query = conn("orders")
        .select(exports.ORDER_COLUMNS)
        .where("customer_id", filter.customerId)
        .where("created_at", ">=", filter.yearStart)
        .where("created_at", "<", filter.yearEnd);
    const rows = await (0, cursor_pagination_1.applyCursorPagination)(query, pagination);
    const result = (0, cursor_pagination_1.buildPaginationResult)(rows, pagination.limit, pagination.sortBy);
    return { data: result.data.map(toEntity), meta: result.meta };
}
/**
 * Filters by BOTH restaurant_id and branch_id. Even with `requireRestaurantMember` +
 * `requireBranchAccess` middleware in front, defense-in-depth — a misconfigured
 * route or a bug elsewhere can never leak another tenant's rows from this repo.
 */
async function findOrdersByRestaurantBranch(filter, pagination, extraFilters, conn) {
    let query = conn("orders")
        .select(exports.ORDER_COLUMNS)
        .where("restaurant_id", filter.restaurantId)
        .where("branch_id", filter.branchId);
    if (filter.status)
        query = query.where("status", filter.status);
    if (filter.from)
        query = query.where("created_at", ">=", filter.from);
    if (filter.to)
        query = query.where("created_at", "<", filter.to);
    query = (0, cursor_pagination_1.applyFilters)(query, extraFilters);
    const rows = await (0, cursor_pagination_1.applyCursorPagination)(query, pagination);
    const result = (0, cursor_pagination_1.buildPaginationResult)(rows, pagination.limit, pagination.sortBy);
    return { data: result.data.map(toEntity), meta: result.meta };
}
