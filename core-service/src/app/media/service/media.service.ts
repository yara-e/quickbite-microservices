import { inject, injectable } from "tsyringe";
import { TOKENS } from "@/lib/di/tokens";
import type { IStorageService } from "@/lib/storage";
import { SystemRole } from "@/app/user/enums";
import { MediaStatus } from "../types";
import { createMedia, findMediaById, updateMediaStatus } from "../repository/media.repo";

@injectable()
export class MediaService {
  constructor(
    @inject(TOKENS.StorageService)
    private readonly storageService: IStorageService
  ) {}

  async createUploadUrl(params: {
    userId: number;
    userRole: SystemRole;
    restaurantId?: number;
    data: { fileName: string; contentType: string };
  }) {
    const { userId, userRole, restaurantId, data } = params;

    const safeFileName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = crypto.randomUUID();

    const prefix =
      userRole === SystemRole.SYSTEM_ADMIN
        ? "restaurants/admin"
        : `restaurants/${restaurantId}`;

    const key = `${prefix}/${uniqueId}-${safeFileName}`;

    const { uploadUrl, publicUrl } =
      await this.storageService.generatePresignedUrl(key, data.contentType, 300);

    const media = await createMedia({
      restaurantId: userRole === SystemRole.SYSTEM_ADMIN ? undefined : restaurantId,
      uploadedBy: userId,
      status: MediaStatus.PENDING,
      mediaUrl: publicUrl,
    });

    return { mediaId: media.id, uploadUrl, mediaUrl: publicUrl };
  }

  async confirmUpload(params: { mediaId: number; userId: number; userRole: SystemRole }) {
    const { mediaId, userId, userRole } = params;

    const media = await findMediaById(mediaId);
    if (!media) throw new Error("Media not found");

    if (userRole !== SystemRole.SYSTEM_ADMIN && media.uploadedBy !== userId) {
      throw new Error("Unauthorized");
    }

    return await updateMediaStatus(mediaId, MediaStatus.UPLOADED);
  }
}