import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  TRUST_SCORE_DEFAULT,
  TRUST_SCORE_MAX,
  TRUST_SCORE_MIN,
  TrustScoreAction,
} from '../enums/trust-score.enums';

export type TrustScoreDocument = HydratedDocument<TrustScore>;

@Schema({ _id: false })
export class TrustScoreHistoryEntry {
  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: String, enum: TrustScoreAction, required: true })
  action!: TrustScoreAction;

  @Prop({ type: Number, required: true })
  pointsChanged!: number;

  @Prop({ type: String, default: '' })
  description!: string;
}

const TrustScoreHistoryEntrySchema = SchemaFactory.createForClass(
  TrustScoreHistoryEntry,
);

@Schema({ timestamps: true })
export class TrustScore {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  user!: Types.ObjectId;

  @Prop({
    type: Number,
    default: TRUST_SCORE_DEFAULT,
    min: TRUST_SCORE_MIN,
    max: TRUST_SCORE_MAX,
  })
  score!: number;

  @Prop({ type: Number, default: 0 })
  strikes!: number;

  @Prop({ type: [TrustScoreHistoryEntrySchema], default: [] })
  history!: TrustScoreHistoryEntry[];

  @Prop({ default: false })
  isRestricted!: boolean;

  @Prop({ type: Date, default: null })
  restrictedUntil!: Date | null;
}

export const TrustScoreSchema = SchemaFactory.createForClass(TrustScore);
