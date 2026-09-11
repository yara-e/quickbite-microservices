import {Request, Response, NextFunction} from "express";
import {errorHandler} from "@/lib/error/errorHandler";
import {AppError} from "@/lib/error/AppError";

jest.mock("@/lib/logger/logger", () => ({
    logger: {error: jest.fn()},
}));

import {logger} from "@/lib/logger/logger";

describe("lib/error/errorHandler", () => {
    const loggerMock = logger.error as jest.Mock;
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {originalUrl: "/api/x", method: "GET", correlationId: "c1"};
        res = {status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis()} as any;
    });

    it("responds with the statusCode + message for operational errors", () => {
        const err = new AppError("bad input", 400);
        errorHandler(err, req as Request, res as Response, jest.fn());
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({error: "bad input"});
        expect(loggerMock).toHaveBeenCalledWith("bad input", expect.objectContaining({operational: true}));
    });

    it("hides non-operational errors behind a generic 500", () => {
        const err = new AppError("secret", 500, false);
        errorHandler(err, req as Request, res as Response, jest.fn());
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({error: "Something went wrong"});
    });

    it("wraps any thrown error into AppError", () => {
        const err = new Error("boom");
        errorHandler(err, req as Request, res as Response, jest.fn());
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({error: "Something went wrong"});
    });
});