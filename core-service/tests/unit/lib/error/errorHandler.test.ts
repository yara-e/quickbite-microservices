import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../../../../src/lib/error/errorHandler";
import { AppError } from "../../../../src/lib/error/AppError";

jest.mock("@/lib/logger/logger", () => ({
    logger: { error: jest.fn() },
}));

import { logger } from "../../../../src/lib/logger/logger";

describe("errorHandler", () => {
    const loggerMock = logger.error as jest.Mock;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { body: { a: 1 }, correlationId: "corr-1" };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        } as any;
        next = jest.fn();
    });

    it("responds with the error statusCode + message for operational errors", () => {
        const err = new AppError("invalid input", 422);
        errorHandler(err, req as Request, res as Response, next);
        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({ error: "invalid input" });
        expect(loggerMock).toHaveBeenCalledWith("invalid input", expect.objectContaining({
            statusCode: 422,
            operational: true,
            correlationId: "corr-1",
        }));
    });

    it("hides the message behind a generic 500 for non-operational errors", () => {
        const err = new AppError("secret", 500, false);
        errorHandler(err, req as Request, res as Response, next);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Something went wrong" });
        expect(loggerMock.mock.calls[0][1].operational).toBe(false);
    });
});