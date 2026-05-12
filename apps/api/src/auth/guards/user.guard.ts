import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class UserAuthGuard extends AuthGuard('jwt') implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) throw new UnauthorizedException();
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== 'user') throw new ForbiddenException('User role required');
    return true;
  }
}
