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
exports.OrderController = void 0;
const tsyringe_1 = require("tsyringe");
const tokens_1 = require("../../../lib/di/tokens");
const response_1 = require("../../../lib/http/response");
const validate_1 = require("../../../lib/validation/validate");
const parse_query_1 = require("../../../lib/http/pagination/parse-query");
const errors_1 = require("../../../lib/sharding/errors");
const order_service_1 = require("../service/order.service");
const order_request_dto_1 = require("../dto/order.request.dto");
let OrderController = class OrderController {
    orderService;
    constructor(orderService) {
        this.orderService = orderService;
    }
    placeOrder = async (req, res, next) => {
        try {
            const data = await (0, validate_1.validateBody)(order_request_dto_1.CreateOrderRequestDTO, req.body);
            const result = await this.orderService.placeOrder({
                userId: req.user.userId,
                role: req.user.role,
                restaurantId: req.user.restaurantId,
                restaurantRole: req.user.restaurantRole,
                branchIds: req.user.branchIds,
            }, data, req.region, req.correlationId);
            (0, response_1.sendSuccess)(res, result, 201);
        }
        catch (err) {
            next(err);
        }
    };
    getOrder = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const result = await this.orderService.getOrder({
                userId: req.user.userId,
                role: req.user.role,
                restaurantId: req.user.restaurantId,
                restaurantRole: req.user.restaurantRole,
                branchIds: req.user.branchIds,
            }, req.region, String(req.params.publicId));
            (0, response_1.sendSuccess)(res, result);
        }
        catch (err) {
            next(err);
        }
    };
    listCustomerOrders = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const year = Number(req.query.year) || new Date().getUTCFullYear();
            const pagination = (0, parse_query_1.parsePaginationQuery)(req.query, ["createdAt"]);
            const result = await this.orderService.listCustomerOrders({ userId: req.user.userId, role: req.user.role }, req.region, year, pagination);
            (0, response_1.sendPaginated)(res, result.data, result.meta);
        }
        catch (err) {
            next(err);
        }
    };
    listRestaurantOrders = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const restaurantId = Number(req.params.restaurantId);
            const branchId = Number(req.params.branchId);
            const pagination = (0, parse_query_1.parsePaginationQuery)(req.query, ["createdAt"]);
            const status = req.query.status;
            const from = req.query.from ? new Date(String(req.query.from)) : undefined;
            const to = req.query.to ? new Date(String(req.query.to)) : undefined;
            const result = await this.orderService.listRestaurantOrders({
                userId: req.user.userId,
                role: req.user.role,
                restaurantId: req.user.restaurantId,
                restaurantRole: req.user.restaurantRole,
                branchIds: req.user.branchIds,
            }, req.region, restaurantId, branchId, status, from, to, [], pagination);
            (0, response_1.sendPaginated)(res, result.data, result.meta);
        }
        catch (err) {
            next(err);
        }
    };
    updateStatus = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const data = await (0, validate_1.validateBody)(order_request_dto_1.UpdateOrderStatusRequestDTO, req.body);
            const result = await this.orderService.updateStatus({
                userId: req.user.userId,
                role: req.user.role,
                restaurantId: req.user.restaurantId,
                restaurantRole: req.user.restaurantRole,
                branchIds: req.user.branchIds,
            }, req.region, String(req.params.publicId), data);
            (0, response_1.sendSuccess)(res, result);
        }
        catch (err) {
            next(err);
        }
    };
};
exports.OrderController = OrderController;
exports.OrderController = OrderController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.OrderService)),
    __metadata("design:paramtypes", [order_service_1.OrderService])
], OrderController);
