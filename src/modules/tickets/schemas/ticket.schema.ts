import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '../enums/ticket.enums';

export type TicketDocument = HydratedDocument<Ticket>;

/**
 * Copia de la promoción aplicada al ticket, congelada en el momento de emitirlo
 * (para que el recibo conserve el desglose aunque la promo cambie o se elimine).
 */
@Schema({ _id: false })
export class TicketPromotion {
  @Prop({ type: Types.ObjectId, ref: 'Promotion', required: true })
  promotion!: Types.ObjectId;

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, required: true })
  type!: string;

  @Prop({ type: Number, required: true })
  discountValue!: number;

  @Prop({ type: String, required: true })
  scope!: string;
}
const TicketPromotionSchema = SchemaFactory.createForClass(TicketPromotion);

/**
 * Copia del cupón aplicado al ticket, congelado al emitirlo (para el recibo).
 */
@Schema({ _id: false })
export class TicketCoupon {
  @Prop({ type: Types.ObjectId, ref: 'Coupon', required: true })
  coupon!: Types.ObjectId;

  @Prop({ type: String, required: true })
  code!: string;

  // porcentaje | monto_fijo | servicio_gratis
  @Prop({ type: String, required: true })
  discountType!: string;

  @Prop({ type: Number, required: true })
  discountValue!: number;

  // Dinero efectivamente descontado por el cupón.
  @Prop({ type: Number, required: true })
  discount!: number;
}
const TicketCouponSchema = SchemaFactory.createForClass(TicketCoupon);

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Ticket {
  @Prop({ required: true, unique: true, index: true })
  ticketNumber!: string; // TB-2024-0001

  @Prop({ type: Types.ObjectId, ref: 'Appointment', required: true })
  appointment!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  client!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Barber', required: true })
  barber!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  service!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  serviceDate!: Date;

  @Prop({ type: Date, required: true })
  completedAt!: Date;

  // Precio original del servicio, antes de descuentos.
  @Prop({ type: Number, required: true, min: 0 })
  basePrice!: number;

  // Monto total descontado (promoción + cupón; 0 si no hubo).
  @Prop({ type: Number, default: 0, min: 0 })
  discount!: number;

  // Precio final cobrado (= basePrice - discount).
  @Prop({ required: true, min: 0 })
  price!: number;

  // Promoción aplicada, congelada al emitir el ticket (null si no hubo).
  @Prop({ type: TicketPromotionSchema, default: null })
  appliedPromotion!: TicketPromotion | null;

  // Cupón aplicado, congelado al emitir el ticket (null si no hubo).
  @Prop({ type: TicketCouponSchema, default: null })
  appliedCoupon!: TicketCoupon | null;

  @Prop({
    type: String,
    enum: PaymentMethod,
    default: PaymentMethod.EFECTIVO,
  })
  paymentMethod!: PaymentMethod;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDIENTE,
  })
  paymentStatus!: PaymentStatus;

  @Prop({ type: Types.ObjectId, ref: 'Hairstyle', default: null })
  hairstyleSelected!: Types.ObjectId | null;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
