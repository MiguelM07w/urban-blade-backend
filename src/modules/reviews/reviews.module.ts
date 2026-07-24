import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentsModule } from '../appointments/appointments.module';
import { BarbersModule } from '../barbers/barbers.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { Review, ReviewSchema } from './schemas/review.schema';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
    AppointmentsModule,
    BarbersModule,
    LoyaltyModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
