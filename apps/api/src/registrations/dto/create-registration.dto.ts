import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRegistrationDto {
  @IsString() @MinLength(1) @MaxLength(200) name_th: string;

  @IsOptional() @IsString() @MaxLength(200) name_en?: string;

  @IsEmail() email: string;

  @IsString() @MinLength(3) @MaxLength(40) phone: string;

  @IsString() @MinLength(8) @MaxLength(200) password: string;

  @IsOptional() @IsString() @MaxLength(200) organization?: string;
  @IsOptional() @IsString() @MaxLength(200) dietary?: string;
  @IsOptional() @IsString() @MaxLength(40) tshirt_size?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
