import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { TenantService } from './tenant.service';
import { IS_PUBLIC_KEY } from '../common/decorators';

/**
 * Valida o JWT (Bearer) emitido pelo backend, anexa `req.user` e resolve o
 * contexto multi-tenant em `req.tenant`. A emissão dos tokens (login/registro,
 * Google/Apple) é construída na Fase 3; este guard apenas os valida.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly tenant: TenantService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Token de autenticação ausente');

    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    req.tenant = await this.tenant.resolve(payload.email);
    return true;
  }
}
