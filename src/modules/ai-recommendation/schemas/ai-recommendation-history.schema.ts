import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AIRecommendationHistoryDocument =
  HydratedDocument<AIRecommendationHistory>;

/**
 * Registro de cada análisis: qué detectó el móvil, qué se recomendó y qué
 * eligió finalmente el usuario. El backend NO procesa imágenes; solo guarda
 * el resultado y la recomendación derivada de la base de datos.
 */
@Schema({ timestamps: true })
export class AIRecommendationHistory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  // Tipo de rostro detectado por el modelo on-device (TensorFlow.js).
  @Prop({ type: String, required: true })
  faceTypeDetected!: string;

  // Tipo de cabello detectado on-device.
  @Prop({ type: String, required: true })
  hairTypeDetected!: string;

  // Estilos recomendados por el backend a partir de lo detectado.
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Hairstyle' }],
    default: [],
  })
  hairstylesRecommended!: Types.ObjectId[];

  // Estilo que el usuario finalmente eligió (puede quedar null).
  @Prop({ type: Types.ObjectId, ref: 'Hairstyle', default: null })
  hairstyleSelected!: Types.ObjectId | null;

  // Selfie opcional subida a Cloudinary.
  @Prop({ type: String, default: null })
  selfieUrl!: string | null;
}

export const AIRecommendationHistorySchema = SchemaFactory.createForClass(
  AIRecommendationHistory,
);
