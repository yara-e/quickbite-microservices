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
exports.AgentService = void 0;
const tsyringe_1 = require("tsyringe");
const container_1 = require("../../../lib/di/container");
const tokens_1 = require("../../../lib/di/tokens");
const knex_1 = require("../../../lib/knex/knex");
const branch_client_1 = require("../../../lib/core-client/branch.client");
const enums_1 = require("../../order/enums");
const order_repo_1 = require("../../order/repository/order.repo");
const order_response_dto_1 = require("../../order/dto/order.response.dto");
const assignment_service_1 = require("../../assignment/service/assignment.service");
const settlement_service_1 = require("./settlement.service");
const agent_response_dto_1 = require("../dto/agent.response.dto");
const agent_earning_repo_1 = require("../repository/agent-earning.repo");
const errors_1 = require("../errors");
const TASK_LIST_LIMIT = 50;
let AgentService = class AgentService {
    assignment;
    settlement;
    constructor(assignment, settlement) {
        this.assignment = assignment;
        this.settlement = settlement;
    }
    get io() {
        return container_1.container.resolve(tokens_1.TOKENS.WsServer);
    }
    async accept(publicId, agentId, region) {
        return this.assignment.claim(publicId, agentId, region);
    }
    async reject(publicId, agentId) {
        await this.assignment.reject(publicId, agentId);
    }
    /** picked / delivered transitions for the assigned agent. */
    async transition(publicId, agentId, region, target) {
        if (target === enums_1.OrderStatus.DELIVERED) {
            const updated = await this.settlement.settleDelivered(publicId, agentId, region);
            const branch = await (0, branch_client_1.getBranch)(updated.branchId).catch(() => null);
            return agent_response_dto_1.DeliveryTaskResponseDTO.from(updated, branch ?? undefined);
        }
        if (target !== enums_1.OrderStatus.PICKED) {
            throw new Error(`agent cannot transition to ${target}`);
        }
        const conn = (0, knex_1.db)(region);
        const order = await (0, order_repo_1.findOrderByPublicId)(publicId, conn);
        if (!order)
            throw new Error("OrderNotFound");
        if (order.deliveryAgentId !== agentId)
            throw errors_1.NotYourTaskError;
        if (order.status !== enums_1.OrderStatus.ASSIGNED)
            throw new Error("OrderNotInAssignedState");
        const trx = await conn.transaction();
        let updated;
        try {
            updated = await (0, order_repo_1.updateOrderStatus)(publicId, enums_1.OrderStatus.PICKED, "picked_at", trx);
            await trx.commit();
        }
        catch (err) {
            await trx.rollback();
            throw err;
        }
        const statusDto = order_response_dto_1.OrderStatusResponseDTO.from(updated);
        this.io.to(`customer:${updated.customerId}`).emit("order.status_changed", statusDto);
        this.io.to(`branch:${updated.branchId}`).emit("order.status_changed", statusDto);
        const branch = await (0, branch_client_1.getBranch)(updated.branchId).catch(() => null);
        return agent_response_dto_1.DeliveryTaskResponseDTO.from(updated, branch ?? undefined);
    }
    async listTasks(agentId, region, statusFilter) {
        const conn = (0, knex_1.db)(region);
        const statuses = statusFilter ? [statusFilter] : [enums_1.OrderStatus.ASSIGNED, enums_1.OrderStatus.PICKED];
        const orders = await (0, order_repo_1.findAgentTasks)(agentId, statuses, TASK_LIST_LIMIT, conn);
        // Single batch lookup for branch enrichment — at most one network
        // round-trip regardless of how many unique branches the agent has
        // tasks at. Cache hits per branch are also served from this call.
        const branchMap = await (0, branch_client_1.getBranchesByIds)(orders.map((o) => o.branchId));
        const enriched = new Map();
        for (const [id, b] of branchMap) {
            enriched.set(id, { lat: b.lat, lng: b.lng, name: b.name, addressText: b.addressText });
        }
        return orders.map((o) => agent_response_dto_1.DeliveryTaskResponseDTO.from(o, enriched.get(o.branchId)));
    }
    async earnings(agentId, region, from, to) {
        const conn = (0, knex_1.db)(region);
        const items = await (0, agent_earning_repo_1.listByAgent)(agentId, { from, to }, 100, conn);
        const sum = await (0, agent_earning_repo_1.sumByAgent)(agentId, { from, to }, conn);
        return agent_response_dto_1.AgentEarningsResponseDTO.from(from, to, items, sum);
    }
};
exports.AgentService = AgentService;
exports.AgentService = AgentService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.AssignmentService)),
    __param(1, (0, tsyringe_1.inject)(tokens_1.TOKENS.SettlementService)),
    __metadata("design:paramtypes", [assignment_service_1.AssignmentService,
        settlement_service_1.SettlementService])
], AgentService);
