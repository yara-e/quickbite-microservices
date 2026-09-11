// tests/unit/lib/http/pagination/parse-query.test.ts

import { parsePaginationQuery } from "../../../../../src/lib/http/pagination/parse-query";

describe("parseQuery pagination", () => {
  it("parses valid limit and page params", () => {
    const result = parsePaginationQuery({ limit: "20" });
    expect(result).toEqual({
      cursor: undefined,
      limit: 20,
      sortBy: "createdAt",
      sortOrder: "asc",
    });
  });

  it("falls back to default options when params are missing or invalid", () => {
    const result = parsePaginationQuery({});
    expect(result.limit).toBe(10); // or expect(result.limit).toBeGreaterThanOrEqual(1)
    expect(result.sortBy).toBe("createdAt");
    expect(result.sortOrder).toBe("asc");
  });

  it("handles invalid non-numeric limit gracefully", () => {
    const result = parsePaginationQuery({ limit: "invalid" });
    expect(result.limit).toBe(10);
  });
});