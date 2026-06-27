import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './modules/company.module';
import { DriverModule } from './modules/driver.module';
import { VehicleModule } from './modules/vehicle.module';
import { AdvanceModule } from './modules/advance.module';
import { BillingModule } from './modules/billing.module';
import { ExpenseModule } from './modules/expense.module';
import { FuelingModule } from './modules/fueling.module';
import { DriverInviteModule } from './modules/driver-invite.module';
import { UserModule } from './modules/user.module';
import { ExportModule } from './modules/export.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    RealtimeModule,
    AuthModule,
    CompanyModule,
    DriverModule,
    VehicleModule,
    AdvanceModule,
    BillingModule,
    ExpenseModule,
    FuelingModule,
    DriverInviteModule,
    UserModule,
    ExportModule,
  ],
})
export class AppModule {}
