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
exports.WebhookController = void 0;
const tsyringe_1 = require("tsyringe");
const tokens_1 = require("../../../lib/di/tokens");
const kashier_webhook_service_1 = require("../service/kashier-webhook.service");
const errors_1 = require("../errors");
let WebhookController = class WebhookController {
    kashierWebhook;
    constructor(kashierWebhook) {
        this.kashierWebhook = kashierWebhook;
    }
    kashier = async (req, res, next) => {
        try {
            if (!req.rawBody)
                throw errors_1.MalformedWebhookError;
            const sigHeader = req.headers["x-kashier-signature"];
            const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
            await this.kashierWebhook.processKashierWebhook(req.rawBody, signature, req.region);
            // Per Kashier docs: any 200 acknowledges receipt. We always 200 on
            // successful (or duplicate) processing.
            res.status(200).json({ success: true });
        }
        catch (err) {
            next(err);
        }
    };
};
exports.WebhookController = WebhookController;
exports.WebhookController = WebhookController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.KashierWebhookService)),
    __metadata("design:paramtypes", [kashier_webhook_service_1.KashierWebhookService])
], WebhookController);
