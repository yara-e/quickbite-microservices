import {
    applyCursorPagination,
    applyFilters,
    buildPaginationResult,
} from "../../../../../src/lib/http/pagination/cursor-pagination";

function createQueryMock() {
    const calls: [string, any[]][] = [];
    const record = (method: string) => (...args: any[]) => {
        calls.push([method, args]);
        return mock;
    };

    const mock: any = {
        calls,
        where: jest.fn().mockImplementation(record("where")),
        whereLike: jest.fn().mockImplementation(record("whereLike")),
        whereIn: jest.fn().mockImplementation(record("whereIn")),
        orderBy: jest.fn().mockImplementation(record("orderBy")),
        limit: jest.fn().mockImplementation(record("limit")),
    };

    return mock;
}

describe("applyCursorPagination", () => {
    it("returns the query untouched when sortBy is empty", () => {
        const q = createQueryMock();
        const out = applyCursorPagination(q, { cursor: "x", limit: 10, sortBy: "", sortOrder: "asc" });
        expect(out).toBe(q);
        expect(q.calls).toEqual([]);
    });

    it("snake_cases the sort column, adds the cursor filter and limit+1", () => {
        const q = createQueryMock();
        applyCursorPagination(q, { cursor: "2025-01-01", limit: 10, sortBy: "createdAt", sortOrder: "desc" });

        expect(q.calls).toEqual([
            ["where", ["created_at", "<", "2025-01-01"]],
            ["orderBy", ["created_at", "desc"]],
            ["limit", [11]],
        ]);
    });

    it("uses > comparator for asc order and skips cursor when missing", () => {
        const q = createQueryMock();
        applyCursorPagination(q, { limit: 5, sortBy: "name", sortOrder: "asc" });
        expect(q.calls).toEqual([
            ["orderBy", ["name", "asc"]],
            ["limit", [6]],
        ]);

        const q2 = createQueryMock();
        applyCursorPagination(q2, { cursor: "z", limit: 5, sortBy: "name", sortOrder: "asc" });
        expect(q2.calls[0]).toEqual(["where", ["name", ">", "z"]]);
    });
});

describe("applyFilters", () => {
    it("maps every supported operator to the right knex method", () => {
        const q = createQueryMock();
        applyFilters(q, [
            { field: "status", operator: "eq", value: "active" },
            { field: "age", operator: "gt", value: "25" },
            { field: "age", operator: "lt", value: "40" },
            { field: "age", operator: "lte", value: "45" },
            { field: "age", operator: "gte", value: "20" },
            { field: "name", operator: "like", value: "bdu" },
            { field: "id", operator: "in", value: ["1", "2"] },
            { field: "tags", operator: "in", value: "solo" },
        ]);

        expect(q.calls).toEqual([
            ["where", ["status", "active"]],
            ["where", ["age", ">", "25"]],
            ["where", ["age", "<", "40"]],
            ["where", ["age", "<=", "45"]],
            ["where", ["age", ">=", "20"]],
            ["whereLike", ["name", "%bdu%"]],
            ["whereIn", ["id", ["1", "2"]]],
            ["whereIn", ["tags", ["solo"]]],
        ]);
    });

    it("returns query reference when filters are empty or unrecognized", () => {
        const q = createQueryMock();
        const out = applyFilters(q, []);
        expect(out).toBe(q);
    });
});

describe("buildPaginationResult", () => {
    const rows = [{ id: 1, createdAt: "a" }, { id: 2, createdAt: "b" }, { id: 3, createdAt: "c" }];

    it("truncates to limit and builds nextCursor when there are more rows", () => {
        const { data, meta } = buildPaginationResult(rows, 2, "createdAt");
        expect(data).toHaveLength(2);
        expect(meta.hasMore).toBe(true);
        expect(meta.nextCursor).toBe("b");
        expect(meta.count).toBe(2);
    });

    it("returns no cursor & hasMore=false when page fits exactly", () => {
        const { data, meta } = buildPaginationResult(rows, 3, "createdAt");
        expect(data).toHaveLength(3);
        expect(meta.hasMore).toBe(false);
        expect(meta.nextCursor).toBeNull();
    });

    it("handles an empty result set", () => {
        const { data, meta } = buildPaginationResult([], 10, "createdAt");
        expect(data).toEqual([]);
        expect(meta).toEqual({ nextCursor: null, hasMore: false, count: 0 });
    });
});