import {IsOptional, IsString, MaxLength, MinLength} from "class-validator";

export class UpdateUserDTO {
    @IsOptional()
    @IsString()
    @MinLength(1)
    name?: string;

    @IsOptional()
    @MinLength(10)
    @MaxLength(11)
    phone?: string;
}
