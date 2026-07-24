import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  AppointmentStatus,
  CancelledBy,
  RecurringType,
} from '../enums/appointment.enums';

export type AppointmentDocument = HydratedDocument<Appointment>;

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  client!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Barber', required: true, index: true })
  barber!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  service!: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  date!: Date;

  @Prop({ required: true })
  startTime!: string; // HH:mm

  @Prop({ required: true })
  endTime!: string; // HH:mm calculado por duración del servicio

  @Prop({
    type: String,
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDIENTE,
    index: true,
  })
  status!: AppointmentStatus;

  @Prop({ type: String, enum: CancelledBy, default: null })
  cancelledBy!: CancelledBy | null;

  @Prop({ type: String, default: null })
  cancelReason!: string | null;

  @Prop({ default: false })
  isRecurring!: boolean;

  @Prop({ type: String, enum: RecurringType, default: null })
  recurringType!: RecurringType | null;

  @Prop({ type: Date, default: null })
  nextRecurringDate!: Date | null;

  @Prop({ type: Date, required: true, index: true })
  confirmationDeadline!: Date; // hora de cita - 2h

  @Prop({ default: false })
  confirmedByClient!: boolean;

  @Prop({ type: Number, default: 0 })
  estimatedWaitTime!: number; // minutos

  @Prop({ default: '' })
  notes!: string;

  @Prop({ type: Types.ObjectId, ref: 'Hairstyle', default: null })
  styleSelected!: Types.ObjectId | null;

  // Código de cupón elegido al reservar. Se valida y congela en el ticket al
  // completar la cita (no se consume al reservar). null si no se usó cupón.
  @Prop({ type: String, default: null })
  couponCode!: string | null;

  // Recordatorios enviados (para no duplicarlos entre ejecuciones del cron).
  @Prop({ default: false })
  reminder24hSent!: boolean;

  @Prop({ default: false })
  reminder1hSent!: boolean;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
