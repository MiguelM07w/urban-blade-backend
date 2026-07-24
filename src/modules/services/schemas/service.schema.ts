import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ServiceCategory } from '../enums/service-category.enum';

export type ServiceDocument = HydratedDocument<Service>;

@Schema({ timestamps: true })
export class Service {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, min: 1 })
  duration!: number; // minutos

  @Prop({ type: String, enum: ServiceCategory, required: true })
  category!: ServiceCategory;

  @Prop({ required: false })
  image?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isMonthlyFeatured!: boolean;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
