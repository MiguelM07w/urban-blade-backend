import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true })
export class Conversation {
  // Participantes de la conversación (normalmente cliente y barbero).
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    required: true,
    index: true,
  })
  participants!: Types.ObjectId[];

  // Cita asociada (opcional): permite abrir chat en contexto de una reserva.
  @Prop({ type: Types.ObjectId, ref: 'Appointment', default: null })
  appointment!: Types.ObjectId | null;

  // Copia del último mensaje para listar conversaciones sin joins.
  @Prop({ type: String, default: '' })
  lastMessage!: string;

  @Prop({ type: Date, default: null })
  lastMessageAt!: Date | null;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
