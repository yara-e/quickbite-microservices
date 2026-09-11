import { Router } from "express";
import { authenticate } from "../../lib/auth/guard";
import { requireInternalApiKey } from "../../lib/auth/api-key";
import { TOKENS } from "../../lib/di/tokens";
import { container } from "../../lib/di/container";
import { CustomerAddressController } from "./controller/customer-address.controller";

export const customerAddressRouter = Router();

const customerAddressController = container.resolve<CustomerAddressController>(TOKENS.CustomerAddressController);

customerAddressRouter.get('/', authenticate, customerAddressController.getAll);
customerAddressRouter.post('/', authenticate, customerAddressController.create);
customerAddressRouter.patch('/:addressId', authenticate, customerAddressController.update);
customerAddressRouter.delete('/:addressId', authenticate, customerAddressController.remove);

// Internal (service-to-service)
customerAddressRouter.get('/internal/:id', requireInternalApiKey, customerAddressController.getById);
