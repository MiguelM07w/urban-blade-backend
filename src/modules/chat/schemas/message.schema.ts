import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessageType } from '../enums/message-type.enum';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true })
export class Message {
  @Prop({
    type: Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  })
  conversation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender!: Types.ObjectId;

  @Prop({ type: String, default: '' })
  content!: string;

  @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
  type!: MessageType;

  // URL de la imagen cuando type = image.
  @Prop({ type: String, default: null })
  imageUrl!: string | null;

  @Prop({ type: Boolean, default: false })
  isRead!: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
