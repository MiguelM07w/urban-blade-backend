import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentsModule } from '../appointments/appointments.module';
import { BarbersModule } from '../barbers/barbers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServicesModule } from '../services/services.module';
import { QueueController } from './queue.controller';
import { QueueCron } from './queue.cron';
import { QueueService } from './queue.service';
import { QueueEntry, QueueEntrySchema } from './schemas/queue-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QueueEntry.name, schema: QueueEntrySchema },
    ]),
    ServicesModule,
    BarbersModule,
    NotificationsModule,
    AppointmentsModule,
  ],
  controllers: [QueueController],
  providers: [QueueService, QueueCron],
})
export class QueueModule {}
