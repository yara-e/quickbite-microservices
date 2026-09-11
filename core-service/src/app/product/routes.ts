import {Router} from "express";
import {authenticate} from "../../lib/auth/guard";
import {rbac, requireRestaurantMember, requireBranchAccess} from "../../lib/auth/rbac";
import {requireInternalApiKey} from "../../lib/auth/api-key";
import {TOKENS} from "../../lib/di/tokens";
import {container} from "../../lib/di/container";
import {ProductController} from "./controller/product.controller";

export const productRouter = Router();

const productController = container.resolve<ProductController>(TOKENS.ProductController);

productRouter.get('/restaurants/:restaurantId/categories', productController.findCategories);
productRouter.get('/branches/:branchId/products', productController.findByBranch);
productRouter.get('/products/:id', productController.findById);

productRouter.get('/restaurants/:restaurantId/products',
    authenticate,
    requireRestaurantMember('restaurantId'),
    rbac({resource:"core:product", action:'read'}),
    productController.findByRestaurant
);
productRouter.post('/restaurants/:restaurantId/products',
    authenticate,
    requireRestaurantMember('restaurantId'),
    rbac({resource:"core:product", action:'create'}),
    productController.create
);
productRouter.patch('/products/:id',
    authenticate,
    requireBranchAccess('branchId'),
    rbac({resource:"core:product", action:'update'}),
    productController.update
);

// Internal (service-to-service)
productRouter.get('/internal/branches/:id/products', requireInternalApiKey, productController.findByBranchAndIds);
productRouter.post('/internal/branches/:id/reserve-stock', requireInternalApiKey, productController.reserveStock);
productRouter.post('/internal/branches/:id/release-stock', requireInternalApiKey, productController.releaseStock);
