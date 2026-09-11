"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachWsServer = attachWsServer;
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const time_1 = require("../../pkg/utils/time");
const env_1 = require("../config/env");
const logger_1 = require("../logger/logger");
const init_1 = require("../cache/init");
const ws_auth_1 = require("./ws-auth");
/**
 * Attaches a socket.io server on /ws with a Redis pub/sub adapter.
 * Multi-process fan-out is automatic: `io.to(room).emit(...)` on any worker
 * reaches every connected socket in every worker for that room.
 *
 * Reuses the shared `redisClient` for PUBLISH; duplicates it for the
 * subscriber (ioredis can't serve commands once in subscribe mode).
 */
function attachWsServer(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        path: "/ws",
        serveClient: false,
        pingInterval: (0, time_1.toMs)(env_1.env.ws.heartbeatSec, 's'),
    });
    io.adapter((0, redis_adapter_1.createAdapter)(init_1.redisClient, init_1.redisClient.duplicate()));
    io.use((socket, next) => {
        try {
            const user = (0, ws_auth_1.authenticateHandshake)(socket.handshake);
            socket.data.user = user;
            socket.data.allowed = (0, ws_auth_1.permittedChannels)(user);
            next();
        }
        catch (err) {
            next(err);
        }
    });
    io.on("connection", (socket) => {
        const allowed = socket.data.allowed;
        const user = socket.data.user;
        socket.emit("hello", { allowedChannels: [...allowed] });
        socket.on("subscribe", (channel, ack) => {
            if (typeof channel !== "string" || !allowed.has(channel)) {
                ack?.({ ok: false, error: "not permitted" });
                return;
            }
            socket.join(channel);
            ack?.({ ok: true });
            socket.emit("subscribed", { channel });
        });
        socket.on("unsubscribe", (channel) => {
            if (typeof channel === "string")
                socket.leave(channel);
        });
        socket.on("disconnect", (reason) => {
            logger_1.logger.info("ws disconnected", { userId: user.userId, reason });
        });
    });
    return io;
}
