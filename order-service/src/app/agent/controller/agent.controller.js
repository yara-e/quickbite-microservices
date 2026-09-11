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
exports.AgentController = void 0;
const tsyringe_1 = require("tsyringe");
const tokens_1 = require("../../../lib/di/tokens");
const response_1 = require("../../../lib/http/response");
const validate_1 = require("../../../lib/validation/validate");
const errors_1 = require("../../../lib/sharding/errors");
const enums_1 = require("../../order/enums");
const agent_request_dto_1 = require("../dto/agent.request.dto");
const presence_service_1 = require("../service/presence.service");
const agent_service_1 = require("../service/agent.service");
let AgentController = class AgentController {
    presence;
    agent;
    constructor(presence, agent) {
        this.presence = presence;
        this.agent = agent;
    }
    /**
     * Online and ping share the same write — UPSERT presence + extend TTL.
     * Both /agents/presence/online and /agents/presence/ping route here.
     */
    presenceUpsert = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const data = await (0, validate_1.validateBody)(agent_request_dto_1.PresenceLocationRequestDTO, req.body);
            await this.presence.upsert(req.region, req.user.userId, data.lat, data.lng);
            (0, response_1.sendSuccess)(res, { ok: true });
        }
        catch (err) {
            next(err);
        }
    };
    offline = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            await this.presence.goOffline(req.region, req.user.userId);
            (0, response_1.sendSuccess)(res, { ok: true });
        }
        catch (err) {
            next(err);
        }
    };
    accept = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const dto = await this.agent.accept(String(req.params.publicId), req.user.userId, req.region);
            (0, response_1.sendSuccess)(res, dto);
        }
        catch (err) {
            next(err);
        }
    };
    reject = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            await this.agent.reject(String(req.params.publicId), req.user.userId);
            (0, response_1.sendSuccess)(res, { ok: true });
        }
        catch (err) {
            next(err);
        }
    };
    /** Body: { status: 'picked' | 'delivered' } */
    transition = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const target = String((req.body ?? {}).status);
            if (target !== enums_1.OrderStatus.PICKED && target !== enums_1.OrderStatus.DELIVERED) {
                return res.status(400).json({ error: "status must be 'picked' or 'delivered'" });
            }
            const dto = await this.agent.transition(String(req.params.publicId), req.user.userId, req.region, target);
            (0, response_1.sendSuccess)(res, dto);
        }
        catch (err) {
            next(err);
        }
    };
    tasks = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const status = req.query.status ? String(req.query.status) : undefined;
            const list = await this.agent.listTasks(req.user.userId, req.region, status);
            (0, response_1.sendSuccess)(res, list);
        }
        catch (err) {
            next(err);
        }
    };
    earnings = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const now = new Date();
            const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            const from = req.query.from ? new Date(String(req.query.from)) : defaultFrom;
            const to = req.query.to ? new Date(String(req.query.to)) : now;
            const dto = await this.agent.earnings(req.user.userId, req.region, from, to);
            (0, response_1.sendSuccess)(res, dto);
        }
        catch (err) {
            next(err);
        }
    };
};
exports.AgentController = AgentController;
exports.AgentController = AgentController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.PresenceService)),
    __param(1, (0, tsyringe_1.inject)(tokens_1.TOKENS.AgentService)),
    __metadata("design:paramtypes", [presence_service_1.PresenceService,
        agent_service_1.AgentService])
], AgentController);
