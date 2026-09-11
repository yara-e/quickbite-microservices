import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IStorageProvider } from "./storage.interface";

export interface S3StorageConfig {
  bucketName: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
  region?: string;
}

export class S3StorageProvider implements IStorageProvider {
  private s3: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(config: S3StorageConfig) {
    this.bucketName = config.bucketName;
    this.publicUrl = config.publicUrl;

    this.s3 = new S3Client({
      region: config.region || "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 300) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });
    const publicUrl = `${this.publicUrl}/${key}`;

    return { uploadUrl, publicUrl };
  }
}