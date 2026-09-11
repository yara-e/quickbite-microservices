"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreUnavailableError = coreUnavailableError;
exports.coreUpstreamError = coreUpstreamError;
const AppError_1 = require("../error/AppError");
function coreUnavailableError(status) {
    return new AppError_1.AppError(`core-service ${status}`, 503);
}
function coreUpstreamError(status, body) {
    return new AppError_1.AppError(`core-service ${status}: ${body}`, status);
}
