import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { WaitingListStatus } from '../enums/waiting-list-status.enum';

export type WaitingListDocument = HydratedDocument<WaitingList>;

/**
 * Rango horario preferido por el cliente.
 */
@Schema({ _id: false })
export class PreferredTimeRange {
  @Prop({ type: String, default: '' })
  start!: string; // HH:mm

  @Prop({ type: String, default: '' })
  end!: string; // HH:mm
}
const PreferredTimeRangeSchema =
  SchemaFactory.createForClass(PreferredTimeRange);

@Schema({ timestamps: true })
export class WaitingList {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  client!: Types.ObjectId;

  // Barbero preferido; null = cualquier barbero.
  @Prop({ type: Types.ObjectId, ref: 'Barber', default: null, index: true })
  barber!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  service!: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  preferredDate!: Date;

  @Prop({ type: PreferredTimeRangeSchema, default: () => ({}) })
  preferredTimeRange!: PreferredTimeRange;

  @Prop({
    type: String,
    enum: WaitingListStatus,
    default: WaitingListStatus.ESPERANDO,
    index: true,
  })
  status!: WaitingListStatus;

  @Prop({ type: Date, default: null })
  notifiedAt!: Date | null;

  // Vence 24h después de la notificación (según spec).
  @Prop({ type: Date, default: null })
  expiresAt!: Date | null;
}

export const WaitingListSchema = SchemaFactory.createForClass(WaitingList);
