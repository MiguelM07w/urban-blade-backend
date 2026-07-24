import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BarbershopConfigDocument = HydratedDocument<BarbershopConfig>;

/**
 * Coordenadas geográficas de la barbería.
 */
@Schema({ _id: false })
export class Coordinates {
  @Prop({ type: Number, default: 0 })
  lat!: number;

  @Prop({ type: Number, default: 0 })
  lng!: number;
}
const CoordinatesSchema = SchemaFactory.createForClass(Coordinates);

/**
 * Horario de apertura para un día de la semana.
 */
@Schema({ _id: false })
export class OpeningHour {
  @Prop({ type: String, required: true })
  dayOfWeek!: string;

  @Prop({ type: String, default: '09:00' })
  startTime!: string;

  @Prop({ type: String, default: '18:00' })
  endTime!: string;

  @Prop({ type: Boolean, default: false })
  isClosed!: boolean;
}
const OpeningHourSchema = SchemaFactory.createForClass(OpeningHour);

/**
 * Día feriado en el que la barbería no abre.
 */
@Schema({ _id: false })
export class Holiday {
  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: String, default: '' })
  description!: string;
}
const HolidaySchema = SchemaFactory.createForClass(Holiday);

/**
 * Enlaces de redes sociales.
 */
@Schema({ _id: false })
export class SocialMedia {
  @Prop({ type: String, default: '' })
  instagram!: string;

  @Prop({ type: String, default: '' })
  facebook!: string;

  @Prop({ type: String, default: '' })
  tiktok!: string;
}
const SocialMediaSchema = SchemaFactory.createForClass(SocialMedia);

/**
 * Configuración global de la barbería. Se maneja como singleton: solo debe
 * existir un documento, gestionado por el admin.
 */
@Schema({ timestamps: true })
export class BarbershopConfig {
  @Prop({ type: String, default: 'Urban Blade' })
  name!: string;

  @Prop({ type: String, default: '' })
  address!: string;

  @Prop({ type: String, default: '' })
  phone!: string;

  @Prop({ type: String, default: '' })
  email!: string;

  @Prop({ type: CoordinatesSchema, default: () => ({}) })
  coordinates!: Coordinates;

  @Prop({ type: String, default: '' })
  googleMapsUrl!: string;

  @Prop({ type: String, default: '' })
  wazeUrl!: string;

  @Prop({ type: String, default: '' })
  logo!: string;

  @Prop({ type: String, default: '' })
  coverImage!: string;

  @Prop({ type: [OpeningHourSchema], default: [] })
  openingHours!: OpeningHour[];

  @Prop({ type: [HolidaySchema], default: [] })
  holidays!: Holiday[];

  @Prop({ type: SocialMediaSchema, default: () => ({}) })
  socialMedia!: SocialMedia;

  // Estilo destacado del mes (referencia a Hairstyle).
  @Prop({ type: Types.ObjectId, ref: 'Hairstyle', default: null })
  currentMonthlyStyle!: Types.ObjectId | null;

  // Barbero del día (referencia a Barber).
  @Prop({ type: Types.ObjectId, ref: 'Barber', default: null })
  barberOfTheDayId!: Types.ObjectId | null;

  // Máximo de citas por slot de tiempo.
  @Prop({ type: Number, default: 1, min: 1 })
  maxAppointmentsPerSlot!: number;

  // Duración de cada slot en minutos.
  @Prop({ type: Number, default: 30, min: 5 })
  slotDuration!: number;

  // Horas de antelación mínima para cancelar sin penalización mayor.
  @Prop({ type: Number, default: 2, min: 0 })
  cancellationWindowHours!: number;

  // Horas antes de la cita en que se pide el doble check.
  @Prop({ type: Number, default: 2, min: 0 })
  doubleCheckHoursBeforeAppointment!: number;

  @Prop({ type: Boolean, default: true })
  isOpen!: boolean;
}

export const BarbershopConfigSchema =
  SchemaFactory.createForClass(BarbershopConfig);
