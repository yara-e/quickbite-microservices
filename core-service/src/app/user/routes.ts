import { Router } from "express";
import { authenticate } from "../../lib/auth/guard";
import { requireInternalApiKey } from "../../lib/auth/api-key";
import { TOKENS } from "../../lib/di/tokens";
import { container } from "../../lib/di/container";
import { UserController } from "./controller/user.controller";

export const userRouter = Router();

const userController = container.resolve<UserController>(TOKENS.UserController);

// protect
userRouter.get('/me', authenticate, userController.getMe);
userRouter.patch('/me', authenticate, userController.updateMe);

// Internal (service-to-service)
userRouter.get('/internal/agents/:id', requireInternalApiKey, userController.getAgentById);
