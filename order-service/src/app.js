"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./lib/config/env");
const routes_1 = require("./routes");
const correlationId_1 = require("./lib/correlation/correlationId");
const region_resolver_1 = require("./lib/sharding/region-resolver");
const errorHandler_1 = require("./lib/error/errorHandler");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({ origin: env_1.env.cors.origins, credentials: true }));
    app.set("query parser", "extended");
    // Stash the raw request body so the webhook handlers can verify HMAC
    // signatures byte-for-byte over the original payload.
    app.use(express_1.default.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    }));
    app.use((0, cookie_parser_1.default)());
    app.use(correlationId_1.correlationId);
    app.use(region_resolver_1.resolveRegion);
    app.use("/api", routes_1.routes);
    app.use(errorHandler_1.errorHandler);
    return app;
}
