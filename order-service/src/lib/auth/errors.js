"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnAuthorisedError = exports.NotAuthenticated = void 0;
const AppError_1 = require("../error/AppError");
exports.NotAuthenticated = new AppError_1.AppError("User not authenticated", 401);
exports.UnAuthorisedError = new AppError_1.AppError("User not authorised", 403);
