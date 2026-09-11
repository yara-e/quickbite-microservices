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
exports.PaymentController = void 0;
const tsyringe_1 = require("tsyringe");
const tokens_1 = require("../../../lib/di/tokens");
const response_1 = require("../../../lib/http/response");
const payment_service_1 = require("../service/payment.service");
let PaymentController = class PaymentController {
    paymentService;
    constructor(paymentService) {
        this.paymentService = paymentService;
    }
    getById = async (req, res, next) => {
        try {
            const restaurantId = Number(req.params.restaurantId);
            const paymentId = Number(req.params.paymentId);
            if (!Number.isFinite(paymentId) || paymentId <= 0) {
                return res.status(400).json({ error: "invalid paymentId" });
            }
            const result = await this.paymentService.getById(paymentId, restaurantId, req.region);
            (0, response_1.sendSuccess)(res, result);
        }
        catch (err) {
            next(err);
        }
    };
};
exports.PaymentController = PaymentController;
exports.PaymentController = PaymentController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.PaymentService)),
    __metadata("design:paramtypes", [payment_service_1.PaymentService])
], PaymentController);
