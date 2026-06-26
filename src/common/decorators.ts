import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthUser, TenantContext } from './auth.types';

/** Usuário autenticado (preenchido pelo JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);

/** Contexto multi-tenant (empresa/motorista) resolvido pelo JwtAuthGuard. */
export const Tenant = createParamDecorator(
  (_data, ctx: ExecutionContext): TenantContext => ctx.switchToHttp().getRequest().tenant,
);

/** Marca uma rota como pública (ignora o JwtAuthGuard). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
