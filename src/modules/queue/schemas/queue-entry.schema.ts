import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { QueueStatus } from '../enums/queue-status.enum';

export type QueueEntryDocument = HydratedDocument<QueueEntry>;

/**
 * Entrada en la fila virtual (walk-in): un cliente que llega sin cita y espera
 * turno. La posición y la hora estimada se calculan al vuelo (no se persisten
 * como verdad, para que se recalculen cuando la fila avanza).
 */
@Schema({ timestamps: true })
export class QueueEntry {
  // Cliente con cuenta. null cuando es un invitado (walk-in anónimo).
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  client!: Types.ObjectId | null;

  // Datos del invitado sin cuenta (solo cuando client es null).
  @Prop({ type: String, default: null })
  guestName!: string | null;

  @Prop({ type: String, default: null })
  guestPhone!: string | null;

  // Barbero preferido; null = cualquiera (se asigna al que se desocupe antes).
  @Prop({ type: Types.ObjectId, ref: 'Barber', default: null, index: true })
  barber!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  service!: Types.ObjectId;

  @Prop({
    type: String,
    enum: QueueStatus,
    default: QueueStatus.ESPERANDO,
    index: true,
  })
  status!: QueueStatus;

  // Momento en que se le avisó que faltan ~10 min (para no repetir el push).
  @Prop({ type: Date, default: null })
  soonNotifiedAt!: Date | null;

  // Momento en que el barbero lo llamó (pasó a "llamado").
  @Prop({ type: Date, default: null })
  calledAt!: Date | null;

  // Momento en que se completó su atención.
  @Prop({ type: Date, default: null })
  servedAt!: Date | null;
}

export const QueueEntrySchema = SchemaFactory.createForClass(QueueEntry);
