import { AppError } from "../../../../src/lib/error/AppError";

describe("AppError", () => {
    it("sets statusCode, message and defaults isOperational to true", () => {
        const err = new AppError("boom", 400);
        expect(err.message).toBe("boom");
        expect(err.statusCode).toBe(400);
        expect(err.isOperational).toBe(true);
        expect(err).toBeInstanceOf(Error);
    });

    it("respects a custom isOperational flag", () => {
        const err = new AppError("internal", 500, false);
        expect(err.isOperational).toBe(false);
    });

    it("defaults to 500 when no statusCode passed", () => {
        const err = new AppError("oops");
        expect(err.statusCode).toBe(500);
    });
});