import {
  BadRequestException, Controller, Get, Injectable, Module, Query, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Tenant } from '../common/decorators';
import { TenantContext } from '../common/auth.types';

const fmt = (v: any): string => {
  if (v instanceof Date) {
    const iso = v.toISOString();
    // colunas @db.Date ficam em 00:00:00Z -> mostra só a data; timestamps em ISO completo
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  return '' + (v ?? '');
};

const toCSV = (rows: any[]): string => {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => `"${fmt(row[h]).replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n');
};

const MODELS: Record<string, string> = {
  Fueling: 'fueling',
  Expense: 'expense',
  Billing: 'billing',
};

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async toCsv(
    tenant: TenantContext,
    entityType: string,
    startDate: string,
    endDate: string,
  ): Promise<string> {
    if (!entityType || !startDate || !endDate)
      throw new BadRequestException('Informe entityType, startDate e endDate');
    const model = MODELS[entityType];
    if (!model)
      throw new BadRequestException('entityType deve ser Fueling, Expense ou Billing');
    if (!tenant.companyId) return '';

    const rows = await (this.prisma as any)[model].findMany({
      where: {
        company_id: tenant.companyId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      orderBy: { date: 'asc' },
    });
    return toCSV(rows);
  }
}

@Controller('export')
export class ExportController {
  constructor(private readonly service: ExportService) {}

  @Get()
  async export(
    @Tenant() tenant: TenantContext,
    @Query('entityType') entityType: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    const csv = await this.service.toCsv(tenant, entityType, startDate, endDate);
    const filename = `${(entityType || 'export').toLowerCase()}_${startDate}_${endDate}.csv`;
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(csv);
  }
}

@Module({ controllers: [ExportController], providers: [ExportService] })
export class ExportModule {}
