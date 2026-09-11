"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const knex_1 = require("../../lib/knex/knex");
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get("/", async (_req, res) => {
    const shards = await (0, knex_1.pingAll)();
    const allOk = shards.every((s) => s.ok);
    res.status(allOk ? 200 : 503).json({
        ok: allOk,
        shards,
    });
});
