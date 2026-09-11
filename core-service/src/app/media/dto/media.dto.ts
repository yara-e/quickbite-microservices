import { IsIn, IsString } from 'class-validator';
import { Expose } from 'class-transformer';

export class CreateUploadUrlDto {
  @IsString()
  fileName!: string;

  // Maps the incoming "fileType" JSON key to the "contentType" property
  @Expose({ name: 'fileType' })
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  contentType!: string;
}