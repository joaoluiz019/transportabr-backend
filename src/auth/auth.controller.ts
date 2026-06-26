import { Body, Controller, Get, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from './tenant.service';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import {
  AppleLoginDto,
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly auth: AuthService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.email, dto.token, dto.password);
  }

  @Public()
  @Post('google')
  google(@Body() dto: GoogleLoginDto) {
    return this.auth.loginWithGoogle(dto.idToken);
  }

  @Public()
  @Post('apple')
  apple(@Body() dto: AppleLoginDto) {
    return this.auth.loginWithApple(dto.identityToken, dto.name);
  }

  /** Equivale a base44.auth.me() — usuário atual + empresa/motorista resolvidos. */
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
      // nunca expõe password_hash/provider_id
      select: { id: true, email: true, name: true, role: true },
    });
    const context = await this.tenant.resolve(user.email);
    return {
      ...record,
      company_id: context.companyId,
      driver_id: context.driverId,
      is_owner: context.isOwner,
    };
  }
}
