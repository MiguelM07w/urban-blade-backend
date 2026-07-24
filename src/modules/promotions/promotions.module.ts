import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { Promotion, PromotionSchema } from './schemas/promotion.schema';
import {
  PromotionRedemption,
  PromotionRedemptionSchema,
} from './schemas/promotion-redemption.schema';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Promotion.name, schema: PromotionSchema },
      {
        name: PromotionRedemption.name,
        schema: PromotionRedemptionSchema,
      },
    ]),
    NotificationsModule,
    LoyaltyModule,
    // forwardRef porque appointments importa promotions y users importa
    // appointments: se cierra el triángulo appointments→promotions→users.
    forwardRef(() => UsersModule),
  ],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
