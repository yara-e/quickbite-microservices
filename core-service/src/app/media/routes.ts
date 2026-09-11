import { Router } from "express";
import { authenticate } from "@/lib/auth/guard";
import { TOKENS } from "@/lib/di/tokens";
import { container } from "@/lib/di/container";
import { MediaController } from "./controller/media.controller";


export const mediaRouter = Router();
const mediaController = container.resolve<MediaController>(TOKENS.MediaController);

mediaRouter.post("/upload-url", authenticate, mediaController.createUploadUrl);
mediaRouter.post("/:mediaId/confirm", authenticate, mediaController.confirmUpload);