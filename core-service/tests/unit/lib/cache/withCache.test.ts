import { NextFunction, Request, Response } from "express";
import { withCache } from "../../../../src/lib/cache/withCache";

jest.mock("@/lib/di/container", () => ({
    container: { resolve: jest.fn() },
}));

import { container } from "../../../../src/lib/di/container";

const resolveMock = container.resolve as jest.Mock;

function makeRes() {
    return {
        statusCode: 200,
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    } as any;
}

describe("withCache middleware", () => {
    beforeEach(() => jest.clearAllMocks());

    it("returns the cached payload with X-Cache: HIT", async () => {
        resolveMock.mockReturnValue({ get: jest.fn().mockResolvedValue('{"data":[1]}'), set: jest.fn() });

        const next = jest.fn() as NextFunction;
        const req = { method: "GET", originalUrl: "/api/branches/nearby" } as unknown as Request;
        const res = makeRes();

        await withCache()(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith("X-Cache", "HIT");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ data: [1] });
        expect(next).not.toHaveBeenCalled();
    });

    it("stores the response body on miss and tags X-Cache: MISS", async () => {
        const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
        resolveMock.mockReturnValue(cache);

        const next = jest.fn() as NextFunction;
        const req = { method: "GET", originalUrl: "/api/restaurants" } as unknown as Request;
        const res = makeRes();

        await withCache(120)(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);

        res.json({ success: true });
        expect(cache.set).toHaveBeenCalledWith("GET:/api/restaurants", '{"success":true}', 120);
        expect(res.setHeader).toHaveBeenCalledWith("X-Cache", "MISS");
    });

    it("does not cache non-2xx responses", async () => {
        const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
        resolveMock.mockReturnValue(cache);

        const next = jest.fn() as NextFunction;
        const req = { method: "GET", originalUrl: "/api/x" } as unknown as Request;
        const res = makeRes();
        res.statusCode = 500;

        await withCache()(req, res, next);
        res.json({ error: "nope" });

        expect(cache.set).not.toHaveBeenCalled();
    });

    it("namespaces the key with the user id when userScoped", async () => {
        const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
        resolveMock.mockReturnValue(cache);

        const next = jest.fn() as NextFunction;
        const req = {
            method: "GET",
            originalUrl: "/api/me",
            user: { userId: 42 },
        } as unknown as Request;
        const res = makeRes();

        await withCache(60, true)(req, res, next);
        res.json({ ok: true });

        expect(cache.set).toHaveBeenCalledWith("GET:/api/me:42", '{"ok":true}', 60);
    });

    it("forwards cache failures to the error handler", async () => {
        resolveMock.mockReturnValue({ get: jest.fn().mockRejectedValue(new Error("down")) });

        const next = jest.fn() as NextFunction;
        const req = { method: "GET", originalUrl: "/api/x" } as unknown as Request;

        await withCache()(req, makeRes(), next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "down" }));
    });
});