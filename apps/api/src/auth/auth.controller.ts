import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class LookupDto {
  @IsString() reference_code: string;
  @IsString() @MinLength(1) password: string;
}
class AdminLoginDto {
  @IsString() username: string;
  @IsString() password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('lookup')
  @HttpCode(200)
  async lookup(@Body() body: LookupDto) {
    return this.auth.lookup(body.reference_code, body.password);
  }

  @Post('admin')
  @HttpCode(200)
  async admin(@Body() body: AdminLoginDto) {
    return this.auth.adminLogin(body.username, body.password);
  }
}
