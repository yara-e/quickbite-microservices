import {retry} from "@/pkg/utils/retry";

describe("pkg/utils/retry", () => {
    beforeEach(() => jest.useFakeTimers());

    afterEach(() => jest.useRealTimers());

    it("returns the result on first success", async () => {
        const fn = jest.fn().mockResolvedValue("ok");
        await expect(retry(fn, {attempts: 3, initialDelayMs: 10, maxDelayMs: 100})).resolves.toBe("ok");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries then succeeds", async () => {
        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error("nope"))
            .mockResolvedValueOnce("yes");

        const promise = retry(fn, {attempts: 3, initialDelayMs: 10, maxDelayMs: 100});
        const assertion = expect(promise).resolves.toBe("yes");

        await jest.runAllTimersAsync();
        await assertion;
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("gives up and rethrows after exhausting attempts", async () => {
        const fn = jest.fn().mockRejectedValue(new Error("always"));

        const promise = retry(fn, {attempts: 3, initialDelayMs: 10, maxDelayMs: 100});
        const assertion = expect(promise).rejects.toThrow("always");

        await jest.runAllTimersAsync();
        await assertion;
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("respects isRetryable predicate", async () => {
        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error("terminal"))
            .mockRejectedValueOnce(new Error("second"));

        const promise = retry(fn, {
            attempts: 3,
            initialDelayMs: 10,
            maxDelayMs: 100,
            isRetryable: (err) => (err as Error).message !== "terminal",
        });
        const assertion = expect(promise).rejects.toThrow("terminal");

        await jest.runAllTimersAsync();
        await assertion;
        expect(fn).toHaveBeenCalledTimes(1);
    });
});