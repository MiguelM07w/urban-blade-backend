import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ContactMessageDocument = HydratedDocument<ContactMessage>;

/**
 * Mensaje enviado desde el formulario público "Contáctanos".
 */
@Schema({ timestamps: true })
export class ContactMessage {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: false, trim: true })
  phone?: string;

  @Prop({ required: true, trim: true })
  message!: string;

  // Para la bandeja del admin: marca si ya se leyó.
  @Prop({ default: false })
  isRead!: boolean;
}

export const ContactMessageSchema =
  SchemaFactory.createForClass(ContactMessage);
