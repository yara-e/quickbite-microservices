"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendPaginated = sendPaginated;
function sendSuccess(res, data, statusCode = 200, meta) {
    const body = { success: true, data };
    if (meta)
        body.meta = meta;
    res.status(statusCode).json(body);
}
function sendPaginated(res, data, meta) {
    res.status(200).json({ success: true, data, meta });
}
