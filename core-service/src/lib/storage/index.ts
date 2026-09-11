import { injectable } from "tsyringe";
import { env } from "@/lib/config/env";
import { S3StorageProvider } from "@/pkg/storage/s3.storage";

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
}

export interface IStorageService {
  generatePresignedUrl(
    key: string,
    contentType: string,
    expiresIn?: number
  ): Promise<PresignedUploadResult>;
}

@injectable()
export class StorageService implements IStorageService {
  private provider: S3StorageProvider;

  constructor() {
    // Reads environment config inside lib/
    this.provider = new S3StorageProvider({
      bucketName: env.r2.bucketName,
      endpoint: env.r2.endpoint,
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
      publicUrl: env.r2.publicUrl,
    });
  }

  async generatePresignedUrl(
    key: string,
    contentType: string,
    expiresIn = 300
  ): Promise<PresignedUploadResult> {
    return await this.provider.getPresignedUploadUrl(key, contentType, expiresIn);
  }
}