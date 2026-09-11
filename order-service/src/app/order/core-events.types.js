"use strict";
/**
 * Inbound core-event payload shapes consumed by the order module's cache
 * projections (CoreDataCacheService). Mirrors what core-service emits via
 * its outbox — do not change without coordinating with
 * core-service/src/lib/events/event-types.ts.
 *
 * Cross-cutting infra event payloads (e.g. rbac.permissions_changed, which
 * lib/rbac/permission-cache.service.ts owns) stay inline in their consumers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
