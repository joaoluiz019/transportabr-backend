import { Controller, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CompanyScopedService } from '../common/company-scoped.service';
import { CompanyScopedController } from '../common/company-scoped.controller';
import { EntitySpec } from '../common/coerce';

const spec: EntitySpec = {
  model: 'fueling',
  fields: {
    vehicle_id: { type: 'uuid', required: true },
    vehicle_plate: { type: 'string' },
    date: { type: 'date', required: true },
    mileage: { type: 'number', required: true },
    liters: { type: 'number', required: true },
    price_per_liter: { type: 'number', required: true },
    total_cost: { type: 'number', required: true },
    fuel_type: { type: 'enum', values: ['gasoline', 'ethanol', 'diesel', 'gnv'] },
    station: { type: 'string' },
    km_per_liter: { type: 'number' },
  },
  filter: ['vehicle_id', 'fuel_type'],
  relations: [{ field: 'vehicle_id', model: 'vehicle' }],
  orderBy: { date: 'desc' },
};

@Injectable()
export class FuelingService extends CompanyScopedService {
  spec = spec;
  constructor(prisma: PrismaService, realtime: RealtimeService) {
    super(prisma, realtime);
  }
}

@Controller('fuelings')
export class FuelingController extends CompanyScopedController {
  constructor(service: FuelingService) {
    super(service);
  }
}

@Module({ controllers: [FuelingController], providers: [FuelingService] })
export class FuelingModule {}
