import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DayOfWeek } from '../enums/day-of-week.enum';

export type BarberDocument = HydratedDocument<Barber>;

@Schema({ _id: false })
export class ScheduleSlot {
  @Prop({ type: String, enum: DayOfWeek, required: true })
  dayOfWeek!: DayOfWeek;

  @Prop({ required: true })
  startTime!: string; // HH:mm

  @Prop({ required: true })
  endTime!: string; // HH:mm

  @Prop({ default: true })
  isAvailable!: boolean;
}

const ScheduleSlotSchema = SchemaFactory.createForClass(ScheduleSlot);

@Schema({ timestamps: true })
export class Barber {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  specialty!: string[];

  @Prop({ type: Number, default: 0, min: 0 })
  experience!: number; // años

  @Prop({ default: '' })
  bio!: string;

  @Prop({ type: [String], default: [] })
  portfolio!: string[];

  @Prop({ type: [ScheduleSlotSchema], default: [] })
  schedule!: ScheduleSlot[];

  @Prop({ type: Number, default: 0, min: 0, max: 5 })
  rating!: number;

  @Prop({ type: Number, default: 0 })
  totalReviews!: number;

  @Prop({ default: false })
  isBarberOfTheDay!: boolean;

  @Prop({ default: true })
  isActive!: boolean;
}

export const BarberSchema = SchemaFactory.createForClass(Barber);
