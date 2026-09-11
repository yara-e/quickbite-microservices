"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateHandshake = authenticateHandshake;
exports.permittedChannels = permittedChannels;
const jwt_1 = require("../auth/jwt");
const errors_1 = require("./errors");
/**
 * Token sources, in order:
 *   1. `auth.token`           - native/mobile clients pass it via io(url, {auth:{token}})
 *   2. `access_token` cookie  - browser sessions reuse the HTTP login cookie
 * Query-string tokens are intentionally NOT supported (they leak into logs).
 */
function authenticateHandshake(handshake) {
    const token = handshake.auth?.token ??
        extractCookie(handshake.headers.cookie, "access_token");
    if (!token)
        throw errors_1.WsNoTokenError;
    return (0, jwt_1.verifyAccessToken)(token);
}
/** Channels (socket.io rooms) the user is allowed to join. */
function permittedChannels(user) {
    const allowed = new Set([`customer:${user.userId}`]);
    if (user.role === "restaurant_user" && user.restaurantId) {
        allowed.add(`restaurant:${user.restaurantId}`);
        for (const b of user.branchIds ?? [])
            allowed.add(`branch:${b}`);
    }
    if (user.role === "delivery_agent") {
        allowed.add(`agent:${user.userId}`);
    }
    return allowed;
}
function extractCookie(cookieHeader, name) {
    if (!cookieHeader)
        return null;
    for (const part of cookieHeader.split(";")) {
        const eq = part.indexOf("=");
        if (eq < 0)
            continue;
        if (part.slice(0, eq).trim() === name)
            return part.slice(eq + 1).trim();
    }
    return null;
}
