import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  PaymentMethod,
  PaymentStatus,
} from '../../payments/enums/payment.enums';
import { OrderChannel, OrderStatus } from '../enums/order-status.enum';

export type OrderDocument = HydratedDocument<Order>;

/**
 * Línea de la compra: un producto con su cantidad. El precio unitario y el
 * nombre se congelan al crear la orden (para que el comprobante no cambie si el
 * producto cambia de precio o se desactiva después).
 */
@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product!: Types.ObjectId;

  @Prop({ type: String, required: true })
  name!: string; // nombre del producto congelado

  @Prop({ type: Number, required: true, min: 0 })
  unitPrice!: number; // precio unitario congelado

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: 0 })
  subtotal!: number; // unitPrice * quantity
}
const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

/**
 * Compra de productos para recoger en el local (BOPIS: no hay envío a domicilio).
 */
@Schema({ timestamps: true })
export class Order {
  // Número legible de la orden: OR-<año>-<secuencia>.
  @Prop({ required: true, unique: true, index: true })
  orderNumber!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  client!: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items!: OrderItem[];

  @Prop({ type: Number, required: true, min: 0 })
  total!: number;

  @Prop({
    type: String,
    enum: OrderStatus,
    default: OrderStatus.PENDIENTE_PAGO,
    index: true,
  })
  status!: OrderStatus;

  @Prop({ type: String, enum: OrderChannel, default: OrderChannel.ONLINE })
  channel!: OrderChannel;

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

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;

  // Momento en que quedó lista para recoger / se recogió.
  @Prop({ type: Date, default: null })
  readyAt!: Date | null;

  @Prop({ type: Date, default: null })
  pickedUpAt!: Date | null;

  // Stripe (compra online con tarjeta).
  @Prop({ type: String, default: null, index: true })
  stripePaymentIntentId!: string | null;

  @Prop({ type: String, default: '' })
  notes!: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
