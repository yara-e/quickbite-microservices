"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionCacheService = void 0;
const tsyringe_1 = require("tsyringe");
const time_1 = require("../../pkg/utils/time");
const logger_1 = require("../logger/logger");
const rbac_client_1 = require("../core-client/rbac.client");
/**
 * In-process cache of permissions per restaurantRole. Source is core-service's
 * `GET /api/internal/rbac/permissions?role=...` (HTTP, via core-client).
 *
 * Mirrors core-service's `PermissionCacheService` (Map + TTL). Invalidation on
 * `rbac.permissions_changed` events clears the entry so the next request
 * re-fetches.
 */
let PermissionCacheService = class PermissionCacheService {
    cache = new Map();
    TTL = (0, time_1.toMs)(1, "h");
    getPermissions = async (roleName) => {
        const cached = this.cache.get(roleName);
        if (cached && Date.now() - cached.cachedAt < this.TTL) {
            return cached.permissions;
        }
        const permissions = await (0, rbac_client_1.getPermissionsByRole)(roleName);
        this.cache.set(roleName, { permissions, cachedAt: Date.now() });
        return permissions;
    };
    hasPermission = (permissions, resource, action) => {
        return permissions.includes(`${resource}:${action}`);
    };
    invalidate = (roleName) => {
        if (roleName)
            this.cache.delete(roleName);
        else
            this.cache.clear();
    };
    /**
     * Thin handler entry point — wired into the core-events consumer registry.
     */
    handlePermissionsChanged = async (payload) => {
        const p = payload;
        this.invalidate(p?.role);
        logger_1.logger.info("rbac.permissions_changed -> permission cache cleared", { role: p?.role ?? "*" });
    };
};
exports.PermissionCacheService = PermissionCacheService;
exports.PermissionCacheService = PermissionCacheService = __decorate([
    (0, tsyringe_1.injectable)()
], PermissionCacheService);
