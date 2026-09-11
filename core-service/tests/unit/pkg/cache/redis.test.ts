import { RedisCacheProvider } from "../../../../src/pkg/cache/redis";

const errorHandlerCb: { current: (err: Error) => void } = { current: () => {} };

jest.mock("ioredis", () => {
    const connection = {
        on: jest.fn((event: string, cb: (err: Error) => void) => {
            if (event === "error") errorHandlerCb.current = cb;
        }),
        connect: jest.fn().mockResolvedValue(undefined),
        set: jest.fn().mockResolvedValue("OK"),
        get: jest.fn().mockResolvedValue("v"),
        del: jest.fn().mockResolvedValue(1),
    };
    return jest.fn().mockImplementation(() => connection);
});

import Redis from "ioredis";

const RedisMock = Redis as unknown as jest.Mock;

describe("RedisCacheProvider", () => {
    let provider: RedisCacheProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        provider = new RedisCacheProvider({ host: "localhost", port: 6379 });
    });

    it("creates an ioredis client with lazyConnect and retries", () => {
        expect(RedisMock).toHaveBeenCalledWith(
            expect.objectContaining({ host: "localhost", port: 6379, lazyConnect: true, maxRetriesPerRequest: 3 })
        );
    });

    it("registers an error listener that logs to console.error", () => {
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        errorHandlerCb.current(new Error("redis boom"));
        expect(spy).toHaveBeenCalledWith("Redis Error:", "redis boom");
        spy.mockRestore();
    });

    it("set stores with an EX TTL when ttl is provided", async () => {
        await provider.set("k", "v", 60);
        const client = RedisMock.mock.results[0].value;
        expect(client.set).toHaveBeenCalledWith("k", "v", "EX", 60);
    });

    it("set stores without TTL when omitted", async () => {
        await provider.set("k", "v");
        const client = RedisMock.mock.results[0].value;
        expect(client.set).toHaveBeenCalledWith("k", "v");
    });

    it("get delegates to client.get", async () => {
        const client = RedisMock.mock.results[0].value;
        client.get.mockResolvedValue("cached");
        await expect(provider.get("k")).resolves.toBe("cached");
    });

    it("del delegates to client.del", async () => {
        const client = RedisMock.mock.results[0].value;
        client.del.mockResolvedValue(1);
        await expect(provider.del("k")).resolves.toBe(1);
    });

    it("getClient returns the underlying ioredis client", () => {
        expect(provider.getClient()).toBe(RedisMock.mock.results[0].value);
    });
});