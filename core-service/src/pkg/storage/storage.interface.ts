export interface IStorageProvider {
  getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn?: number
  ): Promise<{ uploadUrl: string; publicUrl: string }>;
}