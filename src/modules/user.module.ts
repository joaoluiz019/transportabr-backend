import {
  Body, Controller, Get, Injectable, Module, Patch, Query,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { EntitySpec, sanitize } from '../common/coerce';

// updateMe(): vínculos opcionais usados no fluxo de convite de motorista.
const updateSpec: EntitySpec = {
  model: 'user',
  fields: {
    company_id: { type: 'uuid' },
    driver_id: { type: 'uuid' },
    vehicle_id: { type: 'uuid' },
    name: { type: 'string' },
  },
};

const PUBLIC_SELECT = {
  id: true, email: true, name: true, role: true,
  company_id: true, driver_id: true, vehicle_id: true,
};

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  // Lookup por e-mail (usado para associação de motorista). Sem e-mail, retorna vazio.
  findByEmail(email?: string) {
    if (!email) return Promise.resolve([]);
    return this.prisma.user.findMany({ where: { email }, select: PUBLIC_SELECT });
  }

  me(user: AuthUser) {
    return this.prisma.user.findUnique({ where: { id: user.id }, select: PUBLIC_SELECT });
  }

  updateMe(user: AuthUser, body: any) {
    return this.prisma.user.update({
      where: { id: user.id },
      data: sanitize(updateSpec, body, true),
      select: PUBLIC_SELECT,
    });
  }
}

@Controller('users')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.service.me(user);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.service.updateMe(user, body);
  }

  @Get()
  list(@Query('email') email: string) {
    return this.service.findByEmail(email);
  }
}

@Module({ controllers: [UserController], providers: [UserService] })
export class UserModule {}
