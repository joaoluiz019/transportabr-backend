import { Controller, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CompanyScopedService } from '../common/company-scoped.service';
import { CompanyScopedController } from '../common/company-scoped.controller';
import { EntitySpec } from '../common/coerce';

const spec: EntitySpec = {
  model: 'driver',
  fields: {
    name: { type: 'string', required: true },
    email: { type: 'string' },
    phone: { type: 'string' },
    cnh: { type: 'string' },
    cnh_expiry: { type: 'date' },
    toxicological_expiry: { type: 'date' },
    commission_percent: { type: 'number' },
    vehicle_id: { type: 'uuid' },
    status: { type: 'enum', values: ['active', 'inactive'] },
  },
  filter: ['vehicle_id', 'status', 'email'],
  relations: [{ field: 'vehicle_id', model: 'vehicle' }],
  orderBy: { name: 'asc' },
};

@Injectable()
export class DriverService extends CompanyScopedService {
  spec = spec;
  constructor(prisma: PrismaService, realtime: RealtimeService) {
    super(prisma, realtime);
  }
}

@Controller('drivers')
export class DriverController extends CompanyScopedController {
  constructor(service: DriverService) {
    super(service);
  }
}

@Module({ controllers: [DriverController], providers: [DriverService] })
export class DriverModule {}
