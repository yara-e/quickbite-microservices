import {Router} from "express";
import {authenticate} from "../../lib/auth/guard";
import {requireRestaurantMember, rbac} from "../../lib/auth/rbac";
import {requireInternalApiKey} from "../../lib/auth/api-key";
import {withCache} from "../../lib/cache/withCache";
import {TOKENS} from "../../lib/di/tokens";
import {container} from "../../lib/di/container";
import {MemberController} from "./controller/member.controller";

export const rbacRouter = Router();

const memberController = container.resolve<MemberController>(TOKENS.MemberController);

// GET /roles/:role/permissions — public
rbacRouter.get('/roles/:role/permissions', memberController.getRolePermissions);

// Internal (service-to-service)
// Read very often by every consumer; permissions only change on rbac.permissions_changed.
// 5min TTL is fine — staleness window is bounded by event propagation, plus this is a soft cache.
rbacRouter.get('/internal/rbac/permissions', requireInternalApiKey, withCache(300), memberController.getPermissionsByRole);

// POST /restaurants/:restaurantId/members — create/invite member
rbacRouter.post('/restaurants/:restaurantId/members',
    authenticate,
    requireRestaurantMember('restaurantId'),
    rbac({resource:"core:member", action:'create'}),
    memberController.createMember
);

// GET /restaurants/:restaurantId/members — list members
rbacRouter.get('/restaurants/:restaurantId/members',
    authenticate,
    requireRestaurantMember('restaurantId'),
    rbac({resource:"core:member", action:'read'}),
    memberController.listMembers
);

// PATCH /restaurants/:restaurantId/members/:memberId — update member
rbacRouter.patch('/restaurants/:restaurantId/members/:memberId',
    authenticate,
    requireRestaurantMember('restaurantId'),
    rbac({resource:"core:member", action:'update'}),
    memberController.updateMember
);

// DELETE /restaurants/:restaurantId/members/:memberId — delete member
rbacRouter.delete('/restaurants/:restaurantId/members/:memberId',
    authenticate,
    requireRestaurantMember('restaurantId'),
    rbac({resource:"core:member", action:'delete'}),
    memberController.deleteMember
);

// PUT /restaurants/:restaurantId/members/:memberId/branches — update branch assignments
rbacRouter.put('/restaurants/:restaurantId/members/:memberId/branches',
    authenticate,
    requireRestaurantMember('restaurantId'),
    rbac({resource:"core:member", action:'update'}),
    memberController.updateMemberBranches
);
