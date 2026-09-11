import {Router} from "express";
import {authenticate} from "../../lib/auth/guard";
import {rbac, requireRestaurantMember, requireBranchAccess} from "../../lib/auth/rbac";
import {requireInternalApiKey} from "../../lib/auth/api-key";
import {withCache} from "../../lib/cache/withCache";
import {TOKENS} from "../../lib/di/tokens";
import {container} from "../../lib/di/container";
import {BranchController} from "./controller/branch.controller";

export const branchRouter = Router();

const branchController = container.resolve<BranchController>(TOKENS.BranchController);

branchRouter.get('/branches/nearby',withCache(), branchController.findNearby);
branchRouter.get('/restaurants/:restaurantId/branches', branchController.findByRestaurant);
branchRouter.post('/restaurants/:restaurantId/branches',
    authenticate,
    requireRestaurantMember('restaurantId'),
    rbac({resource:"core:branch", action:'create'}),
    branchController.create
);
branchRouter.patch('/branches/:id',
    authenticate,
    requireBranchAccess('id'),
    rbac({resource:"core:branch", action:'update'}),
    branchController.update
);
branchRouter.patch('/branches/:id/status', authenticate, branchController.updateStatus); // system_admin only, checked in service

// Internal (service-to-service)
// Hot path: hit on every order placement. 60s TTL is short enough that
// branch toggles propagate quickly via the branch.* event pipeline.
// The batch endpoint mounts BEFORE the :id one so Express doesn't treat
// the literal "ids" query against a path param.
branchRouter.get('/internal/branches', requireInternalApiKey, withCache(60), branchController.findByIdsWithRestaurant);
branchRouter.get('/internal/branches/:id', requireInternalApiKey, withCache(60), branchController.findByIdWithRestaurant);
