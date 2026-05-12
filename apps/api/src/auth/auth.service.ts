import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { StorageService } from '../storage/storage.service';

export interface AuthTokenPayload {
  sub: string;
  role: 'user' | 'admin';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly storage: StorageService,
    private readonly jwt: JwtService,
  ) {}

  async lookup(referenceCode: string, password: string): Promise<{ token: string; registrationId: string }> {
    const row = await this.storage.findByReferenceCode(referenceCode);
    if (!row) throw new UnauthorizedException('Invalid reference code or password');
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid reference code or password');
    const token = await this.jwt.signAsync({ sub: row.id, role: 'user' } as AuthTokenPayload);
    return { token, registrationId: row.id };
  }

  async adminLogin(username: string, password: string): Promise<{ token: string }> {
    const u = process.env.ADMIN_USERNAME;
    const p = process.env.ADMIN_PASSWORD;
    if (!u || !p) throw new UnauthorizedException('Admin not configured');
    if (username !== u || password !== p) throw new UnauthorizedException('Invalid credentials');
    const token = await this.jwt.signAsync({ sub: 'admin', role: 'admin' } as AuthTokenPayload);
    return { token };
  }
}
