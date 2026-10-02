import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IStorageProvider } from "./storage.interface";

export interface S3StorageConfig {
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string; // Optional custom domain/CloudFront URL
}

export class S3StorageProvider implements IStorageProvider {
  private s3: S3Client;
  private bucketName: string;
  private region: string;
  private publicUrl?: string;

  constructor(config: S3StorageConfig) {
    this.bucketName = config.bucketName;
    this.region = config.region;
    this.publicUrl = config.publicUrl;

    this.s3 = new S3Client({
      region: this.region,
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

    // If a custom CDN/CloudFront URL is provided, use it; otherwise, use the standard S3 URL
    const publicUrl = this.publicUrl
      ? `${this.publicUrl}/${key}`
      : `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

    return { uploadUrl, publicUrl };
  }
}