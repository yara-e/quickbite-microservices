"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCursorPagination = applyCursorPagination;
exports.applyFilters = applyFilters;
exports.buildPaginationResult = buildPaginationResult;
function camelToSnake(str) {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
function applyCursorPagination(query, params) {
    if (!params.sortBy)
        return query;
    const dbColumn = camelToSnake(params.sortBy);
    if (params.cursor) {
        const op = params.sortOrder === "asc" ? ">" : "<";
        query = query.where(dbColumn, op, params.cursor);
    }
    return query.orderBy(dbColumn, params.sortOrder).limit(params.limit + 1);
}
function applyFilters(query, filters) {
    for (const filter of filters) {
        switch (filter.operator) {
            case "eq":
                query.where(filter.field, filter.value);
                break;
            case "gt":
                query.where(filter.field, ">", filter.value);
                break;
            case "lt":
                query.where(filter.field, "<", filter.value);
                break;
            case "lte":
                query.where(filter.field, "<=", filter.value);
                break;
            case "gte":
                query.where(filter.field, ">=", filter.value);
                break;
            case "like":
                query.whereLike(filter.field, `%${filter.value}%`);
                break;
            case "in":
                query.whereIn(filter.field, Array.isArray(filter.value) ? filter.value : [filter.value]);
                break;
        }
    }
    return query;
}
function buildPaginationResult(rows, limit, sortBy) {
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    let nextCursor = null;
    if (data.length > 0) {
        const lastItem = data[data.length - 1];
        nextCursor = hasMore && lastItem ? String(lastItem[sortBy]) : null;
    }
    return {
        data,
        meta: { nextCursor, hasMore, count: data.length },
    };
}
