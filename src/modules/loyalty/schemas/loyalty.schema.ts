import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { LoyaltyLevel } from '../enums/loyalty.enums';

export type LoyaltyDocument = HydratedDocument<Loyalty>;

/**
 * Entrada del historial de movimientos de puntos.
 */
@Schema({ _id: false })
export class LoyaltyHistoryEntry {
  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: String, required: true })
  action!: string;

  @Prop({ type: Number, required: true })
  pointsChanged!: number;

  @Prop({ type: String, default: '' })
  description!: string;
}

const LoyaltyHistoryEntrySchema =
  SchemaFactory.createForClass(LoyaltyHistoryEntry);

@Schema({ timestamps: true })
export class Loyalty {
  // Una sola ficha de fidelización por usuario.
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  user!: Types.ObjectId;

  @Prop({ type: Number, default: 0, min: 0 })
  points!: number;

  @Prop({ type: String, enum: LoyaltyLevel, default: LoyaltyLevel.BRONCE })
  level!: LoyaltyLevel;

  @Prop({ type: Number, default: 0 })
  totalVisits!: number;

  @Prop({ type: Number, default: 0 })
  freeServicesEarned!: number;

  // Niveles cuyo beneficio (bono de servicios gratis) ya se otorgó, para que
  // cada nivel premie una sola vez aunque se recalcule el nivel varias veces.
  @Prop({ type: [String], enum: LoyaltyLevel, default: [] })
  claimedLevelBenefits!: LoyaltyLevel[];

  @Prop({ type: [LoyaltyHistoryEntrySchema], default: [] })
  history!: LoyaltyHistoryEntry[];

  // Código de referido propio, único y autogenerado.
  @Prop({ type: String, required: true, unique: true, index: true })
  referralCode!: string;

  // Usuario que refirió a éste (si lo hubo).
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  referredBy!: Types.ObjectId | null;

  @Prop({ type: Number, default: 0 })
  totalReferrals!: number;
}

export const LoyaltySchema = SchemaFactory.createForClass(Loyalty);
