import { Response } from "express";
import { sendSuccess, sendPaginated } from "../../../../src/lib/http/response";

describe("http/response", () => {
    let res: any;

    beforeEach(() => {
        res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    });

    it("sendSuccess responds with default 200", () => {
        sendSuccess(res, { id: 1 }, 200);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 1 } });
    });

    it("sendSuccess honors custom status code and meta", () => {
        sendSuccess(res, "created", 201, { page: 1 });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: "created", meta: { page: 1 } });
    });

    it("sendPaginated wraps data with the pagination meta", () => {
        const meta = { nextCursor: "abc", hasMore: false, count: 2 };
        sendPaginated(res, ["a", "b"], meta);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: ["a", "b"], meta });
    });
});