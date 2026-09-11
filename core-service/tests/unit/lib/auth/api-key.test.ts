import { NextFunction, Request, Response } from "express";
import { requireInternalApiKey } from "../../../../src/lib/auth/api-key";


jest.mock("@/lib/config/env", () => ({
    env: { internal: { apiKey: "sekret-key" } },
}));

describe("requireInternalApiKey", () => {
    let res: Partial<Response>;

    beforeEach(() => {
        res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    });

    it("passes when the api-key header matches", () => {
        const req = { headers: { "api-key": "sekret-key" } } as unknown as Request;
        const next = jest.fn() as NextFunction;

        requireInternalApiKey(req, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects with 401 when the header does not match", () => {
        const req = { headers: { "api-key": "wrong" } } as unknown as Request;
        const next = jest.fn() as NextFunction;

        requireInternalApiKey(req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Invalid api key" });
        expect(next).not.toHaveBeenCalled();
    });

    it("rejects with 401 when the header is missing", () => {
        const req = { headers: {} } as unknown as Request;
        const next = jest.fn() as NextFunction;

        requireInternalApiKey(req, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
    });
});

describe("requireInternalApiKey when not configured", () => {
    // Re-require with a fresh mock that has no internal key configured.
    let requireInternalApiKeyUnconfigured: (...args: any[]) => void;

    beforeAll(() => {
        jest.resetModules();
        jest.doMock("@/lib/config/env", () => ({
            env: { internal: { apiKey: "" } },
        }));
        requireInternalApiKeyUnconfigured = require("@/lib/auth/api-key").requireInternalApiKey;
    });

    it("responds 500 when env key is falsy", () => {
        const req = { headers: { "api-key": "sekret-key" } } as unknown as Request;
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as any;
        const next = jest.fn() as NextFunction;

        requireInternalApiKeyUnconfigured(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Internal api key not configured" });
    });
});