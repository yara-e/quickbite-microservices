import { Logger, logger } from "../../../../src/lib/logger/logger";

describe("Logger", () => {
    let spy: jest.SpyInstance;

    beforeEach(() => {
        spy = jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        spy.mockRestore();
    });

    it("logs a JSON object with level, message, timestamp and metadata", () => {
        const logger = new Logger();
        logger.info("hello", { userId: 1 });

        expect(spy).toHaveBeenCalledTimes(1);
        const parsed = JSON.parse(spy.mock.calls[0][0]);
        expect(parsed.level).toBe("info");
        expect(parsed.message).toBe("hello");
        expect(parsed.userId).toBe(1);
        expect(typeof parsed.timestamp).toBe("number");
    });

    it("exposes error/warn/debug helpers", () => {
        const logger = new Logger();
        logger.error("err");
        logger.warn("warn");
        logger.debug("dbg", { x: 1 });
        expect(spy).toHaveBeenCalledTimes(3);
        const levels = spy.mock.calls.map((c) => JSON.parse(c[0]).level);
        expect(levels).toEqual(["error", "warn", "debug"]);
    });

    it("exposes a shared singleton", () => {
        expect(logger).toBeInstanceOf(Logger);
        // same instance returned on subsequent constructions
        const another = new Logger();
        expect(another).toBe(logger);
    });
});