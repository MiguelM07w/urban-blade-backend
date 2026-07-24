import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BarbersModule } from '../barbers/barbers.module';
import { BarbershopConfigModule } from '../barbershop-config/barbershop-config.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { ServicesModule } from '../services/services.module';
import { TicketsModule } from '../tickets/tickets.module';
import { TrustScoreModule } from '../trust-score/trust-score.module';
import { UsersModule } from '../users/users.module';
import { WaitingListModule } from '../waiting-list/waiting-list.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsCron } from './appointments.cron';
import { AppointmentsService } from './appointments.service';
import { Appointment, AppointmentSchema } from './schemas/appointment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
    ]),
    ServicesModule,
    forwardRef(() => BarbersModule),
    TicketsModule,
    TrustScoreModule,
    LoyaltyModule,
    NotificationsModule,
    WaitingListModule,
    forwardRef(() => BarbershopConfigModule),
    forwardRef(() => PromotionsModule),
    PaymentsModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsCron],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
