import { Controller, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CompanyScopedService } from '../common/company-scoped.service';
import { CompanyScopedController } from '../common/company-scoped.controller';
import { EntitySpec } from '../common/coerce';

const spec: EntitySpec = {
  model: 'billing',
  fields: {
    vehicle_id: { type: 'uuid', required: true },
    vehicle_plate: { type: 'string' },
    client_name: { type: 'string', required: true },
    amount: { type: 'number', required: true },
    date: { type: 'date', required: true },
    destination: { type: 'string' },
    notes: { type: 'string' },
  },
  filter: ['vehicle_id'],
  relations: [{ field: 'vehicle_id', model: 'vehicle' }],
  orderBy: { date: 'desc' },
};

@Injectable()
export class BillingService extends CompanyScopedService {
  spec = spec;
  constructor(prisma: PrismaService, realtime: RealtimeService) {
    super(prisma, realtime);
  }
}

@Controller('billings')
export class BillingController extends CompanyScopedController {
  constructor(service: BillingService) {
    super(service);
  }
}

@Module({ controllers: [BillingController], providers: [BillingService] })
export class BillingModule {}
