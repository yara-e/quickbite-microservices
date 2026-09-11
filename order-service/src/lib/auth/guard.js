"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jwt_1 = require("./jwt");
const errors_1 = require("./errors");
function authenticate(req, res, next) {
    const token = req.cookies?.access_token;
    if (!token)
        throw errors_1.NotAuthenticated;
    req.user = (0, jwt_1.verifyAccessToken)(token);
    next();
}
