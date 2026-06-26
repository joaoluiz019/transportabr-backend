import { Controller, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CompanyScopedService } from '../common/company-scoped.service';
import { CompanyScopedController } from '../common/company-scoped.controller';
import { EntitySpec } from '../common/coerce';

const spec: EntitySpec = {
  model: 'driverInvite',
  fields: {
    driver_id: { type: 'uuid', required: true },
    vehicle_id: { type: 'uuid' },
    token: { type: 'string', required: true },
    store_url: { type: 'string' },
    is_active: { type: 'boolean' },
  },
  filter: ['driver_id', 'token', 'is_active'],
  relations: [
    { field: 'driver_id', model: 'driver' },
    { field: 'vehicle_id', model: 'vehicle' },
  ],
  orderBy: { created_at: 'desc' },
};

@Injectable()
export class DriverInviteService extends CompanyScopedService {
  spec = spec;
  constructor(prisma: PrismaService, realtime: RealtimeService) {
    super(prisma, realtime);
  }
}

@Controller('driver-invites')
export class DriverInviteController extends CompanyScopedController {
  constructor(service: DriverInviteService) {
    super(service);
  }
}

@Module({ controllers: [DriverInviteController], providers: [DriverInviteService] })
export class DriverInviteModule {}
