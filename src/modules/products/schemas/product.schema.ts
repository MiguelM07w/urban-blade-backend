import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProductCategory } from '../enums/product-category.enum';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  stock!: number;

  @Prop({ required: false })
  image?: string;

  @Prop({ default: '' })
  brand!: string;

  @Prop({ type: String, enum: ProductCategory, required: true })
  category!: ProductCategory;

  // Soft delete: se desactiva en lugar de borrar.
  @Prop({ default: true })
  isActive!: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
