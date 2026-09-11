"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsNoTokenError = void 0;
const AppError_1 = require("../error/AppError");
exports.WsNoTokenError = new AppError_1.AppError("No token provided", 401);
