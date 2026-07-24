import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuditAction, AuditOutcome } from '../enums/audit-action.enum';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/**
 * Registro de una acción sensible ejecutada en el sistema, para trazabilidad y
 * evidencia de controles de seguridad (ISO 27001 / auditoría).
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  @Prop({ type: String, enum: AuditAction, required: true, index: true })
  action!: AuditAction;

  @Prop({ type: String, enum: AuditOutcome, required: true, index: true })
  outcome!: AuditOutcome;

  // Usuario que ejecutó la acción (null si fue anónimo, p. ej. login fallido).
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  actor!: Types.ObjectId | null;

  // Copia del email/rol del actor en el momento (por si el usuario cambia/borra).
  @Prop({ type: String, default: null })
  actorEmail!: string | null;

  @Prop({ type: String, default: null })
  actorRole!: string | null;

  // Método y ruta HTTP de la petición.
  @Prop({ type: String, default: '' })
  method!: string;

  @Prop({ type: String, default: '' })
  path!: string;

  // IP de origen de la petición.
  @Prop({ type: String, default: '' })
  ip!: string;

  // Id del recurso afectado (p. ej. el :id de la ruta), si aplica.
  @Prop({ type: String, default: null })
  targetId!: string | null;

  // Código de estado HTTP de la respuesta.
  @Prop({ type: Number, default: 0 })
  statusCode!: number;

  // Detalle libre (mensaje de error si falló, etc.).
  @Prop({ type: String, default: '' })
  detail!: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
