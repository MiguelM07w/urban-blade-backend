import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import {
  TrustScore,
  TrustScoreSchema,
} from './schemas/trust-score.schema';
import { TrustScoreController } from './trust-score.controller';
import { TrustScoreService } from './trust-score.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrustScore.name, schema: TrustScoreSchema },
    ]),
    forwardRef(() => UsersModule),
  ],
  controllers: [TrustScoreController],
  providers: [TrustScoreService],
  exports: [TrustScoreService],
})
export class TrustScoreModule {}
