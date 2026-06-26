import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, Patch, Post,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { EntitySpec, sanitize } from '../common/coerce';

const spec: EntitySpec = {
  model: 'company',
  fields: {
    name: { type: 'string', required: true },
    cnpj: { type: 'string', required: true },
    address: { type: 'string' },
    phone: { type: 'string' },
  },
};

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  // O dono é identificado pelo e-mail; cada usuário só enxerga a própria empresa.
  list(user: AuthUser) {
    return this.prisma.company.findMany({ where: { owner_email: user.email } });
  }

  create(user: AuthUser, body: any) {
    const data = sanitize(spec, body, false);
    return this.prisma.company.create({
      data: { ...data, owner_email: user.email } as any,
    });
  }

  private async ensureOwned(user: AuthUser, id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company || company.owner_email !== user.email)
      throw new NotFoundException('Empresa não encontrada');
  }

  async update(user: AuthUser, id: string, body: any) {
    await this.ensureOwned(user, id);
    return this.prisma.company.update({ where: { id }, data: sanitize(spec, body, true) });
  }

  async remove(user: AuthUser, id: string) {
    await this.ensureOwned(user, id);
    // ON DELETE CASCADE remove todos os filhos (veículos, motoristas, lançamentos...).
    await this.prisma.company.delete({ where: { id } });
    return { id };
  }
}

@Controller('companies')
export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.service.create(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.service.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}

@Module({ controllers: [CompanyController], providers: [CompanyService] })
export class CompanyModule {}
