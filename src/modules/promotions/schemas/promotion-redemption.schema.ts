import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PromotionRedemptionDocument = HydratedDocument<PromotionRedemption>;

/**
 * Registro de que un usuario ya usó (redimió) una promoción. Garantiza que cada
 * promoción se aplique una sola vez por cliente. El índice compuesto único
 * (promotion + user) impide duplicados a nivel de base de datos.
 */
@Schema({ timestamps: true })
export class PromotionRedemption {
  @Prop({ type: Types.ObjectId, ref: 'Promotion', required: true, index: true })
  promotion!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  // Ticket en el que se aplicó (trazabilidad).
  @Prop({ type: Types.ObjectId, ref: 'Ticket', default: null })
  ticket!: Types.ObjectId | null;
}

export const PromotionRedemptionSchema =
  SchemaFactory.createForClass(PromotionRedemption);

// Un usuario solo puede redimir una promoción una vez.
PromotionRedemptionSchema.index({ promotion: 1, user: 1 }, { unique: true });
