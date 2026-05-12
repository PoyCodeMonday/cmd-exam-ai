import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { AdminModule } from './admin/admin.module';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { ok: true, service: 'cmd-ai-adoption-exam-2026-api' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StorageModule,
    AuthModule,
    RegistrationsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
