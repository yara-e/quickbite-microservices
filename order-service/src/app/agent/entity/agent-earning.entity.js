"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentEarningEntity = void 0;
class AgentEarningEntity {
    id;
    region;
    agentId;
    orderId;
    amount;
    currency;
    earnedAt;
    constructor(data) {
        Object.assign(this, data);
    }
}
exports.AgentEarningEntity = AgentEarningEntity;
