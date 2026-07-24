import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DiscountType } from '../enums/loyalty.enums';

export type CouponDocument = HydratedDocument<Coupon>;

@Schema({ timestamps: true })
export class Coupon {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: String, enum: DiscountType, required: true })
  discountType!: DiscountType;

  @Prop({ type: Number, required: true, min: 0 })
  discountValue!: number;

  // Visitas mínimas del usuario para poder canjear el cupón.
  @Prop({ type: Number, default: 0, min: 0 })
  minVisitsRequired!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  // Usuarios que ya han canjeado este cupón.
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  usedBy!: Types.ObjectId[];

  @Prop({ type: Number, default: 1, min: 1 })
  maxUses!: number;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
