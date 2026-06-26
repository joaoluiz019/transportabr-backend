import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Tenant } from './decorators';
import { TenantContext } from './auth.types';
import { CompanyScopedService } from './company-scoped.service';

/**
 * Controller REST base, espelhando o uso do SDK Base44 no frontend:
 *   GET  /<entidade>?campo=valor      -> filter()
 *   POST /<entidade>                  -> create()
 *   POST /<entidade>/bulk             -> bulkCreate()
 *   PATCH/<entidade>/:id              -> update()
 *   DELETE/<entidade>/:id             -> delete()
 */
export abstract class CompanyScopedController {
  constructor(protected readonly service: CompanyScopedService) {}

  @Get()
  list(@Tenant() tenant: TenantContext, @Query() query: Record<string, any>) {
    return this.service.list(tenant, query);
  }

  @Post()
  create(@Tenant() tenant: TenantContext, @Body() body: any) {
    return this.service.create(tenant, body);
  }

  @Post('bulk')
  bulk(@Tenant() tenant: TenantContext, @Body() body: any) {
    const items = Array.isArray(body) ? body : (body?.items ?? []);
    return this.service.bulkCreate(tenant, items);
  }

  @Patch(':id')
  update(@Tenant() tenant: TenantContext, @Param('id') id: string, @Body() body: any) {
    return this.service.update(tenant, id, body);
  }

  @Delete(':id')
  remove(@Tenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.remove(tenant, id);
  }
}
