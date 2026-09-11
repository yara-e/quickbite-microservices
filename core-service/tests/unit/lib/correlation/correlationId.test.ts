import { Request, Response, NextFunction } from "express";
import { correlationId } from "../../../../src/lib/correlation/correlationId";

describe("correlationId middleware", () => {
    it("assigns a uuid to req.correlationId and sets the response header", () => {
        const req = {} as Request;
        const res = { setHeader: jest.fn() } as unknown as Response;
        const next = jest.fn() as NextFunction;

        correlationId(req, res, next);

        expect(req.correlationId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
        expect(res.setHeader).toHaveBeenCalledWith("X-CorrelationId", expect.any(String));
        expect(next).toHaveBeenCalledTimes(1);
    });
});