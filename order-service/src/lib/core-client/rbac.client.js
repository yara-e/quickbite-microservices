"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPermissionsByRole = getPermissionsByRole;
const core_client_1 = require("./core-client");
async function getPermissionsByRole(role, correlationId) {
    const res = await core_client_1.coreClient.request({
        method: "GET",
        path: `/api/internal/rbac/permissions?role=${encodeURIComponent(role)}`,
        correlationId,
    });
    return res.data?.permissions ?? [];
}
