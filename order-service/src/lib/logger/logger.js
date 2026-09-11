"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
class Logger {
    static instance;
    constructor() {
        if (!Logger.instance)
            Logger.instance = this;
        return Logger.instance;
    }
    log(level, message, metadata = {}) {
        const logObject = {
            level,
            message,
            timestamp: Date.now(),
            ...metadata,
        };
        console.log(JSON.stringify(logObject));
    }
    info(message, metadata = {}) {
        this.log("info", message, metadata);
    }
    error(message, metadata = {}) {
        this.log("error", message, metadata);
    }
    warn(message, metadata = {}) {
        this.log("warn", message, metadata);
    }
    debug(message, metadata = {}) {
        this.log("debug", message, metadata);
    }
}
exports.Logger = Logger;
exports.logger = new Logger();
