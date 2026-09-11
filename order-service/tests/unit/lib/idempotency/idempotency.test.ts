import {NextFunction, Request, Response} from "express";
import {idempotency} from "@/lib/idempotency/idempotency";

jest.mock("@/lib/di/container", () => ({
    container: {resolve: jest.fn()},
}));

import {container} from "@/lib/di/container";

const resolveMock = container.resolve as jest.Mock;

function makeRes(initialStatus = 200) {
    const res: any = {
        statusCode: initialStatus,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    res.json.mockImplementation((body: any) => {
        res.body = body;
        return res;
    });
    return res;
}

describe("lib/idempotency", () => {
    beforeEach(() => jest.clearAllMocks());

    it("skips non-mutating methods", async () => {
        const next = jest.fn() as NextFunction;
        const req = {method: "GET"} as unknown as Request;
        await idempotency({strict: true})(req, makeRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("requires the header in strict mode", async () => {
        const next = jest.fn() as NextFunction;
        const req = {method: "POST", headers: {}, originalUrl: "/x"} as unknown as Request;
        const res = makeRes();
        await idempotency({strict: true})(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({error: "Missing Idempotency-Key header"});
    });

    it("passes through without a key in non-strict mode", async () => {
        const next = jest.fn() as NextFunction;
        const req = {method: "POST", headers: {}, originalUrl: "/x"} as unknown as Request;
        await idempotency()(req, makeRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("replays a cached response for a repeated key", async () => {
        resolveMock.mockReturnValue({get: jest.fn().mockResolvedValue('{"success":true}')});
        const next = jest.fn() as NextFunction;
        const req = {
            method: "POST",
            headers: {"idempotency-key": "abc"},
            originalUrl: "/api/orders",
        } as unknown as Request;
        const res = makeRes();

        await idempotency({strict: true})(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({success: true});
        expect(next).not.toHaveBeenCalled();
    });

    it("wraps res.json to persist the response", async () => {
        const cache = {get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined)};
        resolveMock.mockReturnValue(cache);
        const next = jest.fn() as NextFunction;
        const req = {
            method: "POST",
            headers: {"idempotency-key": "abc"},
            originalUrl: "/api/orders",
        } as unknown as Request;
        const res = makeRes();

        await idempotency()(req, res, next);
        res.json({success: true, data: {}});

        expect(cache.set).toHaveBeenCalledWith(
            "idempotency:POST:/api/orders:abc",
            '{"success":true,"data":{}}',
            86400,
        );
    });

    it("fails closed with 503 in strict mode on cache error", async () => {
        resolveMock.mockReturnValue({get: jest.fn().mockRejectedValue(new Error("down"))});
        const next = jest.fn() as NextFunction;
        const req = {
            method: "POST",
            headers: {"idempotency-key": "abc"},
            originalUrl: "/x",
        } as unknown as Request;
        const res = makeRes();

        await idempotency({strict: true})(req, res, next);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(next).not.toHaveBeenCalled();
    });
});