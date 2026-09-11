"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAgent = requireAgent;
exports.rbac = rbac;
exports.requireRestaurantMember = requireRestaurantMember;
exports.requireBranchAccess = requireBranchAccess;
const tokens_1 = require("../di/tokens");
const container_1 = require("../di/container");
const errors_1 = require("./errors");
const SYSTEM_ADMIN = "system_admin";
const RESTAURANT_USER = "restaurant_user";
const DELIVERY_AGENT = "delivery_agent";
/**
 * Gate routes that may only be called by users with the `delivery_agent`
 * system role. Same shape as requireRestaurantMember — guarantees the actor
 * before the controller has to think about it.
 */
function requireAgent(req, res, next) {
    if (!req.user)
        return res.status(401).json({ error: "User not authenticated" });
    if (req.user.role !== DELIVERY_AGENT)
        return res.status(403).json({ error: "Agent role required" });
    next();
}
function rbac(options) {
    return async (req, res, next) => {
        try {
            if (!req.user)
                throw errors_1.NotAuthenticated;
            const { resource, action, allowSystemAdmin = true } = options;
            if (allowSystemAdmin && req.user.role === SYSTEM_ADMIN) {
                return next();
            }
            if (req.user.role === RESTAURANT_USER) {
                const cache = container_1.container.resolve(tokens_1.TOKENS.PermissionCacheService);
                const permissions = await cache.getPermissions(req.user.restaurantRole);
                if (!cache.hasPermission(permissions, resource, action)) {
                    return res.status(403).json({ error: "Permission denied" });
                }
                return next();
            }
            return res.status(403).json({ error: "Permission denied" });
        }
        catch (err) {
            next(err);
        }
    };
}
function requireRestaurantMember(paramName = "restaurantId") {
    return (req, res, next) => {
        const restaurantId = Number(req.params[paramName]);
        if (!restaurantId)
            return res.status(400).json({ error: `missing ${paramName}` });
        if (req.user?.role === SYSTEM_ADMIN)
            return next();
        if (Number(req.user?.restaurantId) !== restaurantId) {
            return res.status(403).json({ error: "Permission denied" });
        }
        next();
    };
}
function requireBranchAccess(paramName = "branchId") {
    return (req, res, next) => {
        if (req.user?.role === SYSTEM_ADMIN)
            return next();
        if (req.user?.restaurantRole === "owner")
            return next();
        const branchId = Number(req.params[paramName]) || Number(req.query[paramName]);
        if (!branchId)
            return next();
        const userBranchIds = req.user?.branchIds ?? [];
        if (!userBranchIds.includes(branchId)) {
            return res.status(403).json({ error: "You do not have access to this branch" });
        }
        next();
    };
}
