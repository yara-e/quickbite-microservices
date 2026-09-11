"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertEarning = insertEarning;
exports.listByAgent = listByAgent;
exports.sumByAgent = sumByAgent;
const agent_earning_entity_1 = require("../entity/agent-earning.entity");
const AGENT_EARNING_COLUMNS = [
    "id",
    "region",
    "agent_id",
    "order_id",
    "amount",
    "currency",
    "earned_at",
];
function toEntity(row) {
    return new agent_earning_entity_1.AgentEarningEntity({
        id: Number(row.id),
        region: row.region,
        agentId: Number(row.agent_id),
        orderId: Number(row.order_id),
        amount: Number(row.amount),
        currency: row.currency,
        earnedAt: row.earned_at,
    });
}
/**
 * Inserts a single earning row. The unique on `order_id` makes this idempotent —
 * a re-run of the settlement trx hits ON CONFLICT and silently no-ops.
 */
async function insertEarning(input, conn) {
    const rows = await conn("agent_earnings")
        .insert({
        region: input.region,
        agent_id: input.agentId,
        order_id: input.orderId,
        amount: input.amount,
        currency: input.currency,
    })
        .onConflict("order_id")
        .ignore()
        .returning(AGENT_EARNING_COLUMNS);
    if (rows.length === 0)
        return null;
    return toEntity(rows[0]);
}
async function listByAgent(agentId, range, limit, conn) {
    const rows = await conn("agent_earnings")
        .select(AGENT_EARNING_COLUMNS)
        .where("agent_id", agentId)
        .where("earned_at", ">=", range.from)
        .where("earned_at", "<", range.to)
        .orderBy("earned_at", "desc")
        .limit(limit);
    return rows.map(toEntity);
}
async function sumByAgent(agentId, range, conn) {
    const row = await conn("agent_earnings")
        .where("agent_id", agentId)
        .where("earned_at", ">=", range.from)
        .where("earned_at", "<", range.to)
        .sum({ sum: "amount" })
        .first();
    return Number(row?.sum ?? 0);
}
