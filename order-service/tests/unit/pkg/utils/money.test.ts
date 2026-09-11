import {toMinor, fromMinor, sumMinor, multiplyMinor} from "@/pkg/utils/money";

describe("pkg/utils/money", () => {
    it("toMinor rounds major units to minor", () => {
        expect(toMinor(10)).toBe(1000);
        expect(toMinor(10.5)).toBe(1050);
        expect(toMinor(10.555)).toBe(1056);
    });

    it("fromMinor converts minor to major", () => {
        expect(fromMinor(1000)).toBe(10);
        expect(fromMinor(1050)).toBe(10.5);
    });

    it("sumMinor adds values", () => {
        expect(sumMinor([])).toBe(0);
        expect(sumMinor([100, 200, 300])).toBe(600);
    });

    it("multiplyMinor multiplies unit price by quantity", () => {
        expect(multiplyMinor(2500, 2)).toBe(5000);
    });
});