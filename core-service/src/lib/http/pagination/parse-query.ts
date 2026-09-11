import { PaginationParams, FilterParams } from "./cursor-pagination";

const DEFAULT_SORT_BY = 'createdAt';
const DEFAULT_LIMIT = 10;

export function parsePaginationQuery(
    query: Record<string, any>, 
    allowedSortBy: string[] = ['createdAt']
): PaginationParams {
    const sortBy = allowedSortBy.includes(query.sortBy as string)
        ? (query.sortBy as string)
        : DEFAULT_SORT_BY;

    const parsedLimit = parseInt(query.limit, 10);
    const limit = !isNaN(parsedLimit) && parsedLimit > 0
        ? Math.min(1000, parsedLimit)
        : DEFAULT_LIMIT;

    return {
        cursor: (query.cursor as string) || undefined,
        limit,
        sortBy,
        sortOrder: query.sortOrder === 'desc' ? 'desc' : 'asc'
    };
}

export function parseFilters(query: Record<string, any>, allowedFields: string[]): FilterParams[] {
    const filter = query.filter;
    if (!filter || typeof filter !== 'object') return [];

    const allowedOps = new Set(['eq', 'gt', 'lt', 'gte', 'lte', 'like', 'in']);

    return allowedFields.flatMap((field) => {
        const fieldFilters = filter[field];
        if (!fieldFilters || typeof fieldFilters !== 'object') return [];

        return Object.entries(fieldFilters)
            .filter(([op]) => allowedOps.has(op))
            .map(([operator, value]) => ({
                field,
                operator: operator as FilterParams['operator'],
                value: value as string | string[],
            }));
    });
}