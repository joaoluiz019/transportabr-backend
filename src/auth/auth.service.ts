import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto, LoginDto } from './auth.dto';

const APPLE_ISSUER = 'https://appleid.apple.com';

@Injectable()
export class AuthService {
  private readonly google = new OAuth2Client();
  private readonly appleJwks = createRemoteJWKSet(
    new URL('https://appleid.apple.com/auth/keys'),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private audiences(envVar: string): string[] {
    return (process.env[envVar] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Novos usuários cujo e-mail já é de um motorista entram como 'driver'; senão 'admin'. */
  private async roleForEmail(email: string): Promise<'admin' | 'driver'> {
    const driver = await this.prisma.driver.findFirst({ where: { email } });
    return driver ? 'driver' : 'admin';
  }

  private async issue(user: { id: string; email: string; name: string | null; role: string }) {
    const access_token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      access_token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('E-mail já cadastrado');
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name ?? null,
        password_hash: await bcrypt.hash(dto.password, 10),
        provider: 'local',
        role: await this.roleForEmail(email),
      },
    });
    return this.issue(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Usuários migrados do Base44 não têm senha: orienta a redefinir.
    if (user && !user.password_hash)
      throw new ForbiddenException({
        code: 'PASSWORD_RESET_REQUIRED',
        message:
          'A plataforma foi atualizada. Por segurança, defina sua senha pelo link que enviamos ao seu e-mail.',
      });
    if (!user) throw new UnauthorizedException('E-mail ou senha inválidos');
    const ok = await bcrypt.compare(dto.password, user.password_hash!);
    if (!ok) throw new UnauthorizedException('E-mail ou senha inválidos');
    return this.issue(user);
  }

  /** Solicita redefinição/criação de senha. Resposta sempre genérica (não revela existência). */
  async forgotPassword(rawEmail: string) {
    const email = rawEmail.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          reset_token_hash: this.hashToken(token),
          reset_token_expires: new Date(Date.now() + 60 * 60 * 1000), // 1h
        },
      });
      const base = process.env.APP_URL ?? 'http://localhost:5173';
      const url = `${base}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
      await this.mail.sendPasswordReset(email, user.name, url, !user.password_hash);
    }
    return {
      ok: true,
      message: 'Se o e-mail existir, enviamos instruções para definir a senha.',
    };
  }

  async resetPassword(rawEmail: string, token: string, password: string) {
    const email = rawEmail.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid =
      user &&
      user.reset_token_hash &&
      user.reset_token_expires &&
      user.reset_token_expires > new Date() &&
      this.hashToken(token) === user.reset_token_hash;
    if (!valid) throw new BadRequestException('Token inválido ou expirado');

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: await bcrypt.hash(password, 10),
        provider: user.provider ?? 'local',
        reset_token_hash: null,
        reset_token_expires: null,
      },
    });
    return this.issue(updated); // já loga o usuário
  }

  async loginWithGoogle(idToken: string) {
    const audience = this.audiences('GOOGLE_CLIENT_ID');
    if (!audience.length)
      throw new ServiceUnavailableException('Login Google não configurado (defina GOOGLE_CLIENT_ID)');
    let email: string | undefined;
    let name: string | undefined;
    try {
      const ticket = await this.google.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      email = payload?.email;
      name = payload?.name;
    } catch {
      throw new UnauthorizedException('Token Google inválido');
    }
    if (!email) throw new UnauthorizedException('Token Google sem e-mail');
    return this.upsertSocial(email, name, 'google');
  }

  async loginWithApple(identityToken: string, name?: string) {
    const audience = this.audiences('APPLE_CLIENT_ID');
    if (!audience.length)
      throw new ServiceUnavailableException('Login Apple não configurado (defina APPLE_CLIENT_ID)');
    let email: string | undefined;
    try {
      const { payload } = await jwtVerify(identityToken, this.appleJwks, {
        issuer: APPLE_ISSUER,
        audience,
      });
      email = payload.email as string | undefined;
    } catch {
      throw new UnauthorizedException('Token Apple inválido');
    }
    if (!email) throw new UnauthorizedException('Token Apple sem e-mail');
    return this.upsertSocial(email, name, 'apple');
  }

  private async upsertSocial(rawEmail: string, name: string | undefined, provider: string) {
    const email = rawEmail.toLowerCase().trim();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email, name: name ?? null, provider, role: await this.roleForEmail(email) },
      });
    }
    return this.issue(user);
  }
}
