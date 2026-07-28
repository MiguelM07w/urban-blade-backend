import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuthProvider, Role } from '../../../common/enums';
import { FaceType, HairType } from '../enums/user.enums';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  // Password es opcional para usuarios OAuth (google/apple).
  @Prop({ required: false, select: false })
  password?: string;

  @Prop({ required: false, trim: true })
  phone?: string;

  @Prop({ required: false })
  avatar?: string;

  @Prop({ type: String, enum: HairType, required: false })
  hairType?: HairType;

  @Prop({ type: String, enum: FaceType, required: false })
  faceType?: FaceType;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Hairstyle' }], default: [] })
  favoriteStyles!: Types.ObjectId[];

  @Prop({
    type: String,
    enum: AuthProvider,
    default: AuthProvider.EMAIL,
  })
  authProvider!: AuthProvider;

  @Prop({ type: String, enum: Role, default: Role.CLIENT })
  role!: Role;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isBlocked!: boolean;

  @Prop({ type: Date, default: null })
  blockedUntil!: Date | null;

  @Prop({ required: false })
  fcmToken?: string;

  // Hash del refresh token vigente (para rotación / logout).
  @Prop({ required: false, select: false })
  hashedRefreshToken?: string;

  // Fecha de expiración del refresh token vigente. Permite limpiar por cron los
  // hashes de tokens ya expirados. null si no hay sesión activa.
  @Prop({ type: Date, default: null })
  refreshTokenExpiresAt?: Date | null;

  // Hash (bcrypt) del código de recuperación de contraseña vigente. No se guarda
  // en texto plano. null si no hay ninguno activo. select:false para no exponerlo.
  @Prop({ type: String, required: false, select: false, default: null })
  resetPasswordCodeHash?: string | null;

  // Expiración del código de recuperación. null si no hay ninguno activo.
  @Prop({ type: Date, default: null })
  resetPasswordCodeExpiresAt?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
// El índice único de email ya lo declara @Prop({ unique: true }); no se
// duplica aquí para evitar el warning de índice duplicado de Mongoose.
