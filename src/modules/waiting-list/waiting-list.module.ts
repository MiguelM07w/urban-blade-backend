import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  WaitingList,
  WaitingListSchema,
} from './schemas/waiting-list.schema';
import { WaitingListController } from './waiting-list.controller';
import { WaitingListService } from './waiting-list.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WaitingList.name, schema: WaitingListSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [WaitingListController],
  providers: [WaitingListService],
  // Se exporta para que appointments notifique al liberar un cupo.
  exports: [WaitingListService],
})
export class WaitingListModule {}
