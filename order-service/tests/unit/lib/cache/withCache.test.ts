import {NextFunction, Request, Response} from "express";
import {withCache} from "@/lib/cache/withCache";
import {AppError} from "@/lib/error/AppError";

jest.mock("@/lib/di/container", () => ({
    container: {resolve: jest.fn()},
}));

import {container} from "@/lib/di/container";

const resolveMock = container.resolve as jest.Mock;

function makeRes() {
    return {
        statusCode: 200,
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    } as any;
}

describe("lib/cache/withCache", () => {
    beforeEach(() => jest.clearAllMocks());

    it("serves a cached payload with X-Cache HIT", async () => {
        resolveMock.mockReturnValue({get: jest.fn().mockResolvedValue('{"data":[1]}')});
        const next = jest.fn() as NextFunction;
        const req = {method: "GET", originalUrl: "/api/orders/x"} as unknown as Request;
        const res = makeRes();

        await withCache(60)(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith("X-Cache", "HIT");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({data: [1]});
        expect(next).not.toHaveBeenCalled();
    });

    it("stores on miss and tags MISS", async () => {
        const cache = {get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined)};
        resolveMock.mockReturnValue(cache);

        const next = jest.fn() as NextFunction;
        const req = {method: "GET", originalUrl: "/api/orders/1"} as unknown as Request;
        const res = makeRes();

        await withCache(10)(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);

        res.json({success: true});
        expect(cache.set).toHaveBeenCalledWith("GET:/api/orders/1", '{"success":true}', 10);
        expect(res.setHeader).toHaveBeenCalledWith("X-Cache", "MISS");
    });

    it("includes region in the key when present", async () => {
        const cache = {get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined)};
        resolveMock.mockReturnValue(cache);

        const next = jest.fn() as NextFunction;
        const req = {method: "GET", originalUrl: "/api/orders/1", region: "eg"} as unknown as Request;
        const res = makeRes();

        await withCache()(req, res, next);
        res.json({ok: true});

        expect(cache.set).toHaveBeenCalledWith("eg:GET:/api/orders/1", '{"ok":true}', 3600);
    });

    it("forwards errors to next", async () => {
        resolveMock.mockReturnValue({get: jest.fn().mockRejectedValue(new Error("down"))});
        const next = jest.fn() as NextFunction;
        const req = {method: "GET", originalUrl: "/api/x"} as unknown as Request;

        await withCache()(req, makeRes(), next);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({message: "down"}));
    });
});