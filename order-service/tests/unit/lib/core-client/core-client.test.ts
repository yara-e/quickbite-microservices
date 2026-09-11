import {CoreClient} from "@/lib/core-client/core-client";
import {AppError} from "@/lib/error/AppError";

describe("lib/core-client/CoreClient", () => {
    let client: CoreClient;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        client = new CoreClient("http://core.test", "api-key-1");
        fetchMock = jest.fn();
        global.fetch = fetchMock as any;
    });

    const okResponse = (body: unknown) =>
        ({status: 200, ok: true, json: jest.fn().mockResolvedValue(body)} as any);

    it("performs a GET and returns the parsed body with the api-key header", async () => {
        fetchMock.mockResolvedValue(okResponse({success: true, data: {id: 1}}));

        const result = await client.request<{success: boolean; data: {id: number}}>({
            method: "GET",
            path: "/api/internal/branches/1",
        });

        expect(result.data.id).toBe(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url.toString()).toBe("http://core.test/api/internal/branches/1");
        expect(init.headers["api-key"]).toBe("api-key-1");
        expect(init.headers["Content-Type"]).toBe("application/json");
    });

    it("passes correlation + idempotency headers when provided", async () => {
        fetchMock.mockResolvedValue(okResponse({}));
        await client.request({
            method: "POST",
            path: "/x",
            body: {a: 1},
            correlationId: "corr-1",
            idempotencyKey: "ikey",
        });

        const [, init] = fetchMock.mock.calls[0];
        expect(init.headers["X-CorrelationId"]).toBe("corr-1");
        expect(init.headers["Idempotency-Key"]).toBe("ikey");
        expect(init.body).toBe('{"a":1}');
    });

    it("throws coreUnavailableError on 5xx", async () => {
        fetchMock.mockResolvedValue({status: 503, ok: false, text: jest.fn().mockResolvedValue("")});
        await expect(client.request({method: "GET", path: "/x"})).rejects.toMatchObject({
            statusCode: 503,
        });
    });

    it("throws coreUpstreamError on 4xx", async () => {
        fetchMock.mockResolvedValue({status: 404, ok: false, text: jest.fn().mockResolvedValue("nope")});
        await expect(client.request({method: "GET", path: "/x"})).rejects.toMatchObject({
            statusCode: 404,
            message: expect.stringContaining("nope"),
        });
    });

    it("retries on 503 then succeeds", async () => {
        fetchMock
            .mockResolvedValueOnce({status: 503, ok: false, text: jest.fn().mockResolvedValue("")})
            .mockResolvedValueOnce(okResponse({ok: true}));

        const result = await client.request<{ok: boolean}>({method: "GET", path: "/x"});
        expect(result.ok).toBe(true);
        // 1 initial + 1 retry
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("treats 4xx upstream as non-retryable", async () => {
        fetchMock.mockResolvedValue({status: 400, ok: false, text: jest.fn().mockResolvedValue("bad")});
        await expect(client.request({method: "GET", path: "/x"})).rejects.toBeInstanceOf(AppError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});