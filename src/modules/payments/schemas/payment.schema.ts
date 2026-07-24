import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '../enums/payment.enums';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true })
export class Payment {
  // Ticket al que corresponde el pago.
  @Prop({ type: Types.ObjectId, ref: 'Ticket', required: true, index: true })
  ticket!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  client!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  @Prop({
    type: String,
    enum: PaymentMethod,
    default: PaymentMethod.EFECTIVO,
  })
  method!: PaymentMethod;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDIENTE,
    index: true,
  })
  status!: PaymentStatus;

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;

  @Prop({ type: String, default: '' })
  notes!: string;

  // ---- Stripe (null para pagos en efectivo) ----
  // Id del PaymentIntent; se consulta al confirmar el pago vía webhook.
  @Prop({ type: String, default: null, index: true })
  stripePaymentIntentId!: string | null;

  @Prop({ type: String, default: null })
  stripeCustomerId!: string | null;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
