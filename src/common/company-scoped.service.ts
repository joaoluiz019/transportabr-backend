import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { TenantContext } from './auth.types';
import { coerce, EntitySpec, sanitize } from './coerce';

/**
 * Serviço base para entidades escopadas por empresa (company_id).
 * Substitui o RLS do Base44: toda operação é confinada à empresa do usuário.
 */
@Injectable()
export abstract class CompanyScopedService {
  abstract spec: EntitySpec;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly realtime: RealtimeService,
  ) {}

  private get delegate(): any {
    return (this.prisma as any)[this.spec.model];
  }

  private notify(companyId: string, action: 'created' | 'updated' | 'deleted') {
    this.realtime.emitChange(companyId, this.spec.model.toLowerCase(), action);
  }

  private buildFilter(query: Record<string, any>): Record<string, any> {
    const where: Record<string, any> = {};
    for (const key of this.spec.filter ?? []) {
      if (query[key] !== undefined && query[key] !== '') {
        const def = this.spec.fields[key] ?? { type: 'string' as const };
        const v = coerce(def.type, query[key], def.values);
        if (v !== undefined) where[key] = v;
      }
    }
    return where;
  }

  /** Valida que toda FK referenciada pertence à mesma empresa (evita vazamento entre tenants). */
  private async validateRelations(tenant: TenantContext, data: Record<string, any>): Promise<void> {
    for (const rel of this.spec.relations ?? []) {
      const id = data[rel.field];
      if (!id) continue;
      const ref = await (this.prisma as any)[rel.model].findUnique({ where: { id } });
      if (!ref || ref.company_id !== tenant.companyId)
        throw new BadRequestException(`${rel.field} inválido para esta empresa`);
    }
  }

  private async ensureOwned(tenant: TenantContext, id: string): Promise<void> {
    const row = await this.delegate.findUnique({ where: { id } });
    if (!row || row.company_id !== tenant.companyId)
      throw new NotFoundException('Registro não encontrado');
  }

  async list(tenant: TenantContext, query: Record<string, any>): Promise<any[]> {
    if (!tenant.companyId) return [];
    return this.delegate.findMany({
      where: { company_id: tenant.companyId, ...this.buildFilter(query) },
      orderBy: this.spec.orderBy ?? { created_at: 'desc' },
    });
  }

  async create(tenant: TenantContext, body: any): Promise<any> {
    if (!tenant.companyId)
      throw new BadRequestException('Usuário sem empresa associada');
    const data = sanitize(this.spec, body, false);
    await this.validateRelations(tenant, data);
    data.company_id = tenant.companyId;
    const created = await this.delegate.create({ data });
    this.notify(tenant.companyId, 'created');
    return created;
  }

  async bulkCreate(tenant: TenantContext, items: any[]): Promise<{ count: number }> {
    if (!tenant.companyId)
      throw new BadRequestException('Usuário sem empresa associada');
    if (!Array.isArray(items))
      throw new BadRequestException('Esperado um array de registros');
    const data: Record<string, any>[] = [];
    for (const item of items) {
      const row = sanitize(this.spec, item, false);
      await this.validateRelations(tenant, row);
      row.company_id = tenant.companyId;
      data.push(row);
    }
    const result = await this.delegate.createMany({ data });
    this.notify(tenant.companyId, 'created');
    return result;
  }

  async update(tenant: TenantContext, id: string, body: any): Promise<any> {
    await this.ensureOwned(tenant, id);
    const data = sanitize(this.spec, body, true);
    await this.validateRelations(tenant, data);
    const updated = await this.delegate.update({ where: { id }, data });
    this.notify(tenant.companyId!, 'updated');
    return updated;
  }

  async remove(tenant: TenantContext, id: string): Promise<{ id: string }> {
    await this.ensureOwned(tenant, id);
    await this.delegate.delete({ where: { id } });
    this.notify(tenant.companyId!, 'deleted');
    return { id };
  }
}
