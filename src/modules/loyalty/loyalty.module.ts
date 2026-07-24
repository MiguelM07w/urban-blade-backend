import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Coupon, CouponSchema } from './schemas/coupon.schema';
import { Loyalty, LoyaltySchema } from './schemas/loyalty.schema';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Loyalty.name, schema: LoyaltySchema },
      { name: Coupon.name, schema: CouponSchema },
    ]),
  ],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  // Se exporta para que appointments (visita completada) y reviews (+10 pts)
  // puedan sumar puntos.
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
