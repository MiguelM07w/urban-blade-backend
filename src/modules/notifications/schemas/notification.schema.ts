import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { NotificationType } from '../enums/notification-type.enum';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  // Usuario destinatario de la notificación.
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ type: String, enum: NotificationType, required: true, index: true })
  type!: NotificationType;

  // Payload extra libre (p. ej. { ticketId, appointmentId }). Sin esquema fijo
  // porque cada tipo de notificación transporta datos distintos.
  @Prop({ type: Object, default: {} })
  data!: Record<string, unknown>;

  @Prop({ default: false })
  isRead!: boolean;

  // Momento en que se envió el push (puede diferir de createdAt si se encola).
  @Prop({ type: Date, default: () => new Date() })
  sentAt!: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
