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
exports.AssignmentController = void 0;
const tsyringe_1 = require("tsyringe");
const tokens_1 = require("../../../lib/di/tokens");
const response_1 = require("../../../lib/http/response");
const errors_1 = require("../../../lib/sharding/errors");
const assignment_service_1 = require("../service/assignment.service");
let AssignmentController = class AssignmentController {
    assignment;
    constructor(assignment) {
        this.assignment = assignment;
    }
    /** POST /admin/orders/:publicId/assign  body: { agentId } */
    adminAssign = async (req, res, next) => {
        try {
            if (!req.region || req.region === "all")
                throw errors_1.RegionNotResolvedError;
            const agentId = Number((req.body ?? {}).agentId);
            if (!Number.isFinite(agentId) || agentId <= 0) {
                return res.status(400).json({ error: "agentId is required" });
            }
            const dto = await this.assignment.adminAssign(String(req.params.publicId), agentId, req.region);
            (0, response_1.sendSuccess)(res, dto);
        }
        catch (err) {
            next(err);
        }
    };
};
exports.AssignmentController = AssignmentController;
exports.AssignmentController = AssignmentController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.AssignmentService)),
    __metadata("design:paramtypes", [assignment_service_1.AssignmentService])
], AssignmentController);
