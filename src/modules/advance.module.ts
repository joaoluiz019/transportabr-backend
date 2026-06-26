import { Controller, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CompanyScopedService } from '../common/company-scoped.service';
import { CompanyScopedController } from '../common/company-scoped.controller';
import { EntitySpec } from '../common/coerce';

const spec: EntitySpec = {
  model: 'advance',
  fields: {
    driver_id: { type: 'uuid', required: true },
    driver_name: { type: 'string' },
    amount: { type: 'number', required: true },
    date: { type: 'date', required: true },
    description: { type: 'string' },
  },
  filter: ['driver_id'],
  relations: [{ field: 'driver_id', model: 'driver' }],
  orderBy: { date: 'desc' },
};

@Injectable()
export class AdvanceService extends CompanyScopedService {
  spec = spec;
  constructor(prisma: PrismaService, realtime: RealtimeService) {
    super(prisma, realtime);
  }
}

@Controller('advances')
export class AdvanceController extends CompanyScopedController {
  constructor(service: AdvanceService) {
    super(service);
  }
}

@Module({ controllers: [AdvanceController], providers: [AdvanceService] })
export class AdvanceModule {}
