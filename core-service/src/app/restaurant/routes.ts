import {Router} from "express";
import {authenticate} from "../../lib/auth/guard";
import {rbac, requireRestaurantMember} from "../../lib/auth/rbac";
import {TOKENS} from "../../lib/di/tokens";
import {container} from "../../lib/di/container";
import {RestaurantController} from "./controller/restaurant.controller";

export const restaurantRouter = Router();

const restaurantController = container.resolve<RestaurantController>(TOKENS.RestaurantController);

restaurantRouter.get('/', restaurantController.getAll);
restaurantRouter.get('/:id', restaurantController.getById);
restaurantRouter.post('/', authenticate, restaurantController.create); // system_admin only, checked in service
restaurantRouter.patch('/:id',
    authenticate,
    requireRestaurantMember('id'),
    rbac({resource:"core:restaurant", action:'update'}),
    restaurantController.update
);
restaurantRouter.patch('/:id/status', authenticate, restaurantController.updateStatus); // system_admin only, checked in service
