"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = retry;
async function retry(fn, opts) {
    let delay = opts.initialDelayMs;
    let lastErr;
    for (let i = 0; i < opts.attempts; i++) {
        try {
            return await fn();
        }
        catch (err) {
            lastErr = err;
            if (opts.isRetryable && !opts.isRetryable(err))
                throw err;
            if (i === opts.attempts - 1)
                break;
            await new Promise((r) => setTimeout(r, delay));
            delay = Math.min(delay * 2, opts.maxDelayMs);
        }
    }
    throw lastErr;
}
