import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "@/lib/di/tokens";
import { MediaService } from "../service/media.service";
import { CreateUploadUrlDto } from "../dto/media.dto";
import { validateBody } from "@/lib/validation/validate";
import { SystemRole } from "@/app/user/enums";

@injectable()
export class MediaController {
    constructor(
        @inject(TOKENS.MediaService) private readonly mediaService: MediaService
    ) { }

    createUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await validateBody(CreateUploadUrlDto
                , req.body);
            const result = await this.mediaService.createUploadUrl({
                userId: req.user!.userId,
                userRole: req.user!.role as SystemRole,
                restaurantId: req.user?.restaurantId,
                data,
            });

            return res.status(201).json({ message: "Upload URL created", ...result });
        } catch (err) {
            next(err);
        }
    };

    confirmUpload = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const mediaId = Number(req.params.mediaId);
            const result = await this.mediaService.confirmUpload({
                mediaId,
                userId: req.user!.userId,
                userRole: req.user!.role as SystemRole,
            });

            return res.json({ message: "Upload confirmed", media: result });
        } catch (err) {
            next(err);
        }
    };
}