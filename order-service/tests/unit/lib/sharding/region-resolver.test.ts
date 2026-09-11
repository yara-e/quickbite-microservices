import {Request, Response, NextFunction} from "express";
import {resolveRegion, requireRegion, requireConcreteRegion} from "@/lib/sharding/region-resolver";
import {RegionNotResolvedError} from "@/lib/sharding/errors";

function makeReq(headers: Record<string, unknown> = {}, query: Record<string, unknown> = {}) {
    return {headers, query} as unknown as Request;
}

describe("lib/sharding/region-resolver", () => {
    let next: NextFunction;

    beforeEach(() => {
        next = jest.fn();
    });

    it("resolves region from the X-Region header", () => {
        const req = makeReq({"x-region": "EG"});
        resolveRegion(req, {} as Response, next);
        expect(req.region).toBe("eg");
    });

    it("resolves region from the query string fallback", () => {
        const req = makeReq({}, {region: "ksa"});
        resolveRegion(req, {} as Response, next);
        expect(req.region).toBe("ksa");
    });

    it("does not set region when nothing is provided", () => {
        const req = makeReq();
        resolveRegion(req, {} as Response, next);
        expect(req.region).toBeUndefined();
    });

    it("preserves the all fan-out value", () => {
        const req = makeReq({"x-region": "all"});
        resolveRegion(req, {} as Response, next);
        expect(req.region).toBe("all");
    });

    it("requireRegion throws when region missing", () => {
        const req = makeReq();
        expect(() => requireRegion(req, {} as Response, next)).toThrow(RegionNotResolvedError);
    });

    it("requireRegion passes when region is set", () => {
        const req = makeReq({"x-region": "eg"});
        resolveRegion(req, {} as Response, next);
        requireRegion(req, {} as Response, next);
        expect(next).toHaveBeenCalledTimes(2);
    });

    it("requireConcreteRegion rejects the all value", () => {
        const req = makeReq({"x-region": "all"});
        expect(() => requireConcreteRegion(req, {} as Response, next)).toThrow(RegionNotResolvedError);
    });

    it("requireConcreteRegion passes for a concrete region", () => {
        const req = makeReq({"x-region": "eg"});
        resolveRegion(req, {} as Response, next);
        requireConcreteRegion(req, {} as Response, next);
        expect(next).toHaveBeenCalledTimes(2);
    });
});