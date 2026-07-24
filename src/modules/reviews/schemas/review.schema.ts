import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  client!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Barber', required: true, index: true })
  barber!: Types.ObjectId;

  // Una sola reseña por cita: índice único.
  @Prop({
    type: Types.ObjectId,
    ref: 'Appointment',
    required: true,
    unique: true,
  })
  appointment!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ default: '' })
  comment!: string;

  // URLs de fotos adjuntas (Cloudinary).
  @Prop({ type: [String], default: [] })
  photos!: string[];

  // Permite ocultar reseñas sin borrarlas (moderación / soft delete).
  @Prop({ default: true })
  isVisible!: boolean;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
