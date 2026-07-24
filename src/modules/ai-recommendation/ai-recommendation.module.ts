import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BarbersModule } from '../barbers/barbers.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AIRecommendationController } from './ai-recommendation.controller';
import { AIRecommendationService } from './ai-recommendation.service';
import {
  AIRecommendationHistory,
  AIRecommendationHistorySchema,
} from './schemas/ai-recommendation-history.schema';
import { Hairstyle, HairstyleSchema } from './schemas/hairstyle.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Hairstyle.name, schema: HairstyleSchema },
      {
        name: AIRecommendationHistory.name,
        schema: AIRecommendationHistorySchema,
      },
    ]),
    BarbersModule,
    NotificationsModule,
    ChatModule,
  ],
  controllers: [AIRecommendationController],
  providers: [AIRecommendationService],
  exports: [AIRecommendationService],
})
export class AIRecommendationModule {}
