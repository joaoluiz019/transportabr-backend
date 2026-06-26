import { Controller, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CompanyScopedService } from '../common/company-scoped.service';
import { CompanyScopedController } from '../common/company-scoped.controller';
import { EntitySpec } from '../common/coerce';

const spec: EntitySpec = {
  model: 'expense',
  fields: {
    vehicle_id: { type: 'uuid', required: true },
    vehicle_plate: { type: 'string' },
    type: {
      type: 'enum',
      required: true,
      values: [
        'maintenance', 'oil_change', 'tire', 'insurance', 'tax', 'fine',
        'payroll', 'commission', 'travel_bonus', 'overnight', 'toll', 'bonus',
        'body', 'financiamento', 'other',
      ],
    },
    amount: { type: 'number', required: true },
    date: { type: 'date', required: true },
    supplier: { type: 'string' },
    description: { type: 'string' },
    mileage_at_service: { type: 'number' },
    next_service_mileage: { type: 'number' },
    next_service_date: { type: 'date' },
    tire_brand: { type: 'string' },
    tire_model: { type: 'string' },
    tire_position: { type: 'string' },
  },
  filter: ['vehicle_id', 'type'],
  relations: [{ field: 'vehicle_id', model: 'vehicle' }],
  orderBy: { date: 'desc' },
};

@Injectable()
export class ExpenseService extends CompanyScopedService {
  spec = spec;
  constructor(prisma: PrismaService, realtime: RealtimeService) {
    super(prisma, realtime);
  }
}

@Controller('expenses')
export class ExpenseController extends CompanyScopedController {
  constructor(service: ExpenseService) {
    super(service);
  }
}

@Module({ controllers: [ExpenseController], providers: [ExpenseService] })
export class ExpenseModule {}
