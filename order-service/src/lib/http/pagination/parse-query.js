"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePaginationQuery = parsePaginationQuery;
exports.parseFilters = parseFilters;
const DEFAULT_SORT_BY = "createdAt";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
function parsePaginationQuery(query, allowedSortBy = ["createdAt"]) {
    const sortBy = allowedSortBy.includes(query.sortBy)
        ? query.sortBy
        : DEFAULT_SORT_BY;
    const parsedLimit = Number(query.limit);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(MAX_LIMIT, parsedLimit)
        : DEFAULT_LIMIT;
    return {
        cursor: query.cursor,
        limit,
        sortBy,
        sortOrder: query.sortOrder === "asc" ? "asc" : "desc",
    };
}
function parseFilters(query, allowedFields) {
    const filter = query.filter;
    if (!filter || typeof filter !== "object")
        return [];
    const allowedOps = new Set(["eq", "gt", "lt", "gte", "lte", "like", "in"]);
    return allowedFields.flatMap((field) => {
        const fieldFilters = filter[field];
        if (!fieldFilters || typeof fieldFilters !== "object")
            return [];
        return Object.entries(fieldFilters)
            .filter(([op]) => allowedOps.has(op))
            .map(([operator, value]) => ({
            field,
            operator: operator,
            value: value,
        }));
    });
}
