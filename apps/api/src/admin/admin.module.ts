import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { RegistrationsModule } from '../registrations/registrations.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RegistrationsModule, AuthModule],
  controllers: [AdminController],
})
export class AdminModule {}
