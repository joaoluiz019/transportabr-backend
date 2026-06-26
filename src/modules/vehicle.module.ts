import { Controller, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CompanyScopedService } from '../common/company-scoped.service';
import { CompanyScopedController } from '../common/company-scoped.controller';
import { EntitySpec } from '../common/coerce';

const spec: EntitySpec = {
  model: 'vehicle',
  fields: {
    plate: { type: 'string', required: true },
    model: { type: 'string', required: true },
    brand: { type: 'string', required: true },
    year: { type: 'number' },
    mileage: { type: 'number' },
    driver_id: { type: 'uuid' },
    driver_name: { type: 'string' },
    status: { type: 'enum', values: ['active', 'maintenance', 'inactive'] },
    registration_expiry: { type: 'date' },
    desired_km_per_liter: { type: 'number' },
  },
  filter: ['driver_id', 'status', 'plate'],
  relations: [{ field: 'driver_id', model: 'driver' }],
  orderBy: { plate: 'asc' },
};

@Injectable()
export class VehicleService extends CompanyScopedService {
  spec = spec;
  constructor(prisma: PrismaService, realtime: RealtimeService) {
    super(prisma, realtime);
  }
}

@Controller('vehicles')
export class VehicleController extends CompanyScopedController {
  constructor(service: VehicleService) {
    super(service);
  }
}

@Module({ controllers: [VehicleController], providers: [VehicleService] })
export class VehicleModule {}
