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
exports.FinanceController = void 0;
const tsyringe_1 = require("tsyringe");
const tokens_1 = require("../../../lib/di/tokens");
const response_1 = require("../../../lib/http/response");
const validate_1 = require("../../../lib/validation/validate");
const errors_1 = require("../../../lib/sharding/errors");
const finance_service_1 = require("../service/finance.service");
const finance_request_dto_1 = require("../dto/finance.request.dto");
const PAYOUT_LIST_LIMIT = 50;
let FinanceController = class FinanceController {
    finance;
    constructor(finance) {
        this.finance = finance;
    }
    getBalance = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const restaurantId = Number(req.params.restaurantId);
            const dto = await this.finance.getBalance(restaurantId, req.region);
            (0, response_1.sendSuccess)(res, dto);
        }
        catch (err) {
            next(err);
        }
    };
    listPayouts = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const restaurantId = Number(req.params.restaurantId);
            const now = new Date();
            const defaultFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            const from = req.query.from ? new Date(String(req.query.from)) : defaultFrom;
            const to = req.query.to ? new Date(String(req.query.to)) : now;
            const items = await this.finance.listPayouts(restaurantId, req.region, from, to, PAYOUT_LIST_LIMIT);
            (0, response_1.sendSuccess)(res, items);
        }
        catch (err) {
            next(err);
        }
    };
    /** POST /admin/restaurants/:restaurantId/payouts */
    createPayout = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const body = await (0, validate_1.validateBody)(finance_request_dto_1.CreatePayoutRequestDTO, {
                ...req.body,
                restaurantId: Number(req.params.restaurantId),
            });
            const idempotencyKey = String(req.headers["idempotency-key"] ?? "");
            const dto = await this.finance.recordPayout(body, req.region, idempotencyKey);
            (0, response_1.sendSuccess)(res, dto, 201);
        }
        catch (err) {
            next(err);
        }
    };
};
exports.FinanceController = FinanceController;
exports.FinanceController = FinanceController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.FinanceService)),
    __metadata("design:paramtypes", [finance_service_1.FinanceService])
], FinanceController);
