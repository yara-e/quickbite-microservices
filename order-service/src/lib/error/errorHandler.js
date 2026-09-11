"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("../logger/logger");
const AppError_1 = require("./AppError");
function errorHandler(err, req, res, _next) {
    const appErr = err instanceof AppError_1.AppError ? err : new AppError_1.AppError(err?.message ?? "Unknown error", 500, false);
    const operational = appErr.isOperational;
    logger_1.logger.error(appErr.message, {
        statusCode: appErr.statusCode,
        stack: appErr.stack,
        operational,
        path: req.originalUrl,
        method: req.method,
        correlationId: req.correlationId,
    });
    if (operational) {
        return res.status(appErr.statusCode).json({ error: appErr.message });
    }
    return res.status(500).json({ error: "Something went wrong" });
}
