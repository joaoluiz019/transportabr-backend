import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/auth.types';

/**
 * Resolve o contexto multi-tenant a partir do e-mail do usuário, espelhando a
 * lógica do frontend: o dono é encontrado por Company.owner_email; um motorista
 * é encontrado por Driver.email (e herda a empresa do seu Driver).
 */
@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(email: string): Promise<TenantContext> {
    const company = await this.prisma.company.findFirst({
      where: { owner_email: email },
    });
    if (company) {
      return { companyId: company.id, driverId: null, isOwner: true };
    }

    const driver = await this.prisma.driver.findFirst({ where: { email } });
    if (driver) {
      return { companyId: driver.company_id, driverId: driver.id, isOwner: false };
    }

    return { companyId: null, driverId: null, isOwner: false };
  }
}
