import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    forwardRef(() => UsersModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // Se exporta para que appointments, loyalty y reviews puedan notificar.
  exports: [NotificationsService],
})
export class NotificationsModule {}
