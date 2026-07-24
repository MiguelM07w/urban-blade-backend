import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { FaceType, HairType } from '../../users/enums/user.enums';
import { HairstyleCategory } from '../enums/hairstyle-category.enum';

export type HairstyleDocument = HydratedDocument<Hairstyle>;

/**
 * Catálogo de cortes. Es la entidad referenciada por User.favoriteStyles,
 * Appointment.styleSelected, Ticket.hairstyleSelected y la config mensual.
 */
@Schema({ timestamps: true })
export class Hairstyle {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  // Tipos de rostro para los que este corte es recomendable.
  @Prop({ type: [String], enum: FaceType, default: [] })
  faceTypes!: FaceType[];

  // Tipos de cabello compatibles.
  @Prop({ type: [String], enum: HairType, default: [] })
  hairTypes!: HairType[];

  @Prop({ type: [String], default: [] })
  images!: string[];

  // Imagen PNG para el overlay 2D en el móvil.
  @Prop({ default: '' })
  overlayImage!: string;

  @Prop({ type: String, enum: HairstyleCategory, required: true })
  category!: HairstyleCategory;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isTrending!: boolean;
}

export const HairstyleSchema = SchemaFactory.createForClass(Hairstyle);
