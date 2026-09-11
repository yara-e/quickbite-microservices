"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAuthCookie = setAuthCookie;
function setAuthCookie(res, token, maxAgeSec) {
    res.cookie("access_token", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: maxAgeSec * 1000,
        path: "/",
    });
}
