import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ServiceCategory } from '../../services/enums/service-category.enum';
import {
  PromotionScope,
  PromotionType,
  TargetAudience,
} from '../enums/promotion.enums';

export type PromotionDocument = HydratedDocument<Promotion>;

@Schema({ timestamps: true })
export class Promotion {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ required: false })
  image?: string;

  @Prop({ type: String, enum: PromotionType, required: true })
  type!: PromotionType;

  // Para type=descuento, discountValue es un PORCENTAJE (0-100) sobre el precio
  // del servicio. Para type=servicio_gratis el precio final es 0.
  @Prop({ type: Number, default: 0, min: 0 })
  discountValue!: number;

  @Prop({ type: Date, required: true })
  startDate!: Date;

  @Prop({ type: Date, required: true })
  endDate!: Date;

  @Prop({
    type: String,
    enum: TargetAudience,
    default: TargetAudience.TODOS,
  })
  targetAudience!: TargetAudience;

  // A qué aplica el descuento (para el cálculo de precio).
  @Prop({
    type: String,
    enum: PromotionScope,
    default: PromotionScope.TODOS,
  })
  scope!: PromotionScope;

  // Categoría afectada cuando scope=categoria.
  @Prop({ type: String, enum: ServiceCategory, default: null })
  category!: ServiceCategory | null;

  // Servicios afectados cuando scope=servicios.
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Service' }], default: [] })
  services!: Types.ObjectId[];

  // Soft delete / activación.
  @Prop({ default: true })
  isActive!: boolean;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
