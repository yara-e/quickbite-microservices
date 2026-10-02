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
    this.provider = new S3StorageProvider({
      bucketName: env.s3.bucketName,
      region: env.s3.region,
      accessKeyId: env.s3.accessKeyId,
      secretAccessKey: env.s3.secretAccessKey,
      publicUrl: env.s3.publicUrl,
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