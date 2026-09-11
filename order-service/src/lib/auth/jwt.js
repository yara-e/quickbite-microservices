"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const errors_1 = require("./errors");
function verifyAccessToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwt.accessSecret);
        return {
            userId: decoded.userId,
            role: decoded.role,
            email: decoded.email,
            restaurantId: decoded.restaurantId,
            restaurantRole: decoded.restaurantRole,
            branchIds: decoded.branchIds,
        };
    }
    catch {
        throw errors_1.NotAuthenticated;
    }
}
function verifyRefreshToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwt.refreshSecret);
        return {
            userId: decoded.userId,
            role: decoded.role,
            email: decoded.email,
            restaurantId: decoded.restaurantId,
            restaurantRole: decoded.restaurantRole,
            branchIds: decoded.branchIds,
        };
    }
    catch {
        throw errors_1.NotAuthenticated;
    }
}
