import { toMs, toSeconds } from "../../../../src/pkg/utils/time";

describe("pkg/utils/time", () => {
    it("converts units to milliseconds", () => {
        expect(toMs(1, "s")).toBe(1000);
        expect(toMs(2, "m")).toBe(120000);
        expect(toMs(3, "h")).toBe(3 * 60 * 60 * 1000);
        expect(toMs(4, "d")).toBe(4 * 24 * 60 * 60 * 1000);
    });

    it("converts units to seconds", () => {
        expect(toSeconds(1, "s")).toBe(1);
        expect(toSeconds(1, "m")).toBe(60);
        expect(toSeconds(1, "h")).toBe(3600);
        expect(toSeconds(1, "d")).toBe(86400);
    });
});