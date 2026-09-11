"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationId = correlationId;
const uuid_1 = require("uuid");
function correlationId(req, res, next) {
    const incoming = req.headers["x-correlationid"] || req.headers["x-correlation-id"];
    const id = typeof incoming === "string" && incoming.length > 0 ? incoming : (0, uuid_1.v4)();
    req.correlationId = id;
    res.setHeader("X-CorrelationId", id);
    next();
}
