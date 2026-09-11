"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestaurantNotFoundError = exports.InsufficientBalanceError = void 0;
const AppError_1 = require("../../lib/error/AppError");
exports.InsufficientBalanceError = new AppError_1.AppError("InsufficientBalance", 409);
exports.RestaurantNotFoundError = new AppError_1.AppError("RestaurantNotFound", 404);
