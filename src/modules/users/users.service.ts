import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuthProvider, Role } from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Verifica que el usuario autenticado pueda editar la cuenta `targetId`: el
   * admin puede editar cualquiera; el resto solo la suya. Lanza
   * ForbiddenException si no tiene permiso.
   */
  private assertCanEdit(targetId: string, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && targetId !== user.userId) {
      throw new ForbiddenException('Solo puedes editar tu propio perfil');
    }
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .exec();
    if (existing) {
      throw new BadRequestException('El email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const created = new this.userModel({
      ...dto,
      email: dto.email.toLowerCase(),
      password: hashedPassword,
    });
    return created.save();
  }

  /**
   * Devuelve (creándolo la primera vez) el usuario genérico "invitado de
   * mostrador", usado para registrar atenciones directas (walk-in) de personas
   * sin cuenta. Es un único usuario reutilizable; no recibe fidelización ni
   * notificaciones. Permite que el ticket y las estadísticas del barbero
   * funcionen sin exigir una cuenta real por cada walk-in.
   */
  async getOrCreateGuestUser(): Promise<UserDocument> {
    const email = 'walk-in@urbanblade.local';
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      return existing;
    }
    const created = new this.userModel({
      name: 'Invitado de mostrador',
      email,
      role: Role.CLIENT,
      isActive: true,
    });
    return created.save();
  }

  /**
   * Crea un usuario a partir de un proveedor OAuth (google/apple), sin password.
   */
  async createOAuthUser(data: {
    name: string;
    email: string;
    avatar?: string;
    authProvider: AuthProvider;
  }): Promise<UserDocument> {
    const created = new this.userModel({
      ...data,
      email: data.email.toLowerCase(),
      role: Role.CLIENT,
    });
    return created.save();
  }

  async findAll(pagination: PaginationDto): Promise<{
    items: UserDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit } = pagination;
    const filter = { isActive: true };
    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }

  /**
   * Devuelve los IDs (como string) de todos los usuarios activos. Usado por
   * notifications para difundir a toda la base de usuarios.
   */
  async findAllActiveIds(): Promise<string[]> {
    const users = await this.userModel
      .find({ isActive: true })
      .select('_id')
      .lean()
      .exec();
    return users.map((u) => u._id.toString());
  }

  /**
   * Devuelve los IDs (como string) de los usuarios activos con un rol concreto.
   * Usado para dirigir notificaciones (p. ej. solo clientes en promociones, o
   * solo admins en avisos internos).
   */
  async findActiveIdsByRole(role: Role): Promise<string[]> {
    const users = await this.userModel
      .find({ isActive: true, role })
      .select('_id')
      .lean()
      .exec();
    return users.map((u) => u._id.toString());
  }

  /**
   * Devuelve los administradores activos con datos mínimos y públicos
   * (`_id, name, avatar`). Pensado para que el staff (barbero/admin) descubra a
   * quién escribir por chat, sin exponer datos sensibles del resto de usuarios.
   */
  async findActiveAdmins(): Promise<
    Array<{ _id: Types.ObjectId; name: string; avatar?: string }>
  > {
    return this.userModel
      .find({ isActive: true, role: Role.ADMIN })
      .select('_id name avatar')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  /**
   * Devuelve los IDs de usuarios activos registrados desde una fecha dada.
   * Usado por promotions para segmentar "nuevos clientes".
   */
  async findActiveIdsRegisteredSince(since: Date): Promise<string[]> {
    // createdAt lo añade el schema con timestamps:true; el filtro va como
    // objeto plano porque el tipo User no lo declara explícitamente.
    const filter: Record<string, unknown> = {
      isActive: true,
      createdAt: { $gte: since },
    };
    const users = await this.userModel.find(filter).select('_id').lean().exec();
    return users.map((u) => u._id.toString());
  }

  async findById(id: string): Promise<UserDocument> {
    this.assertValidId(id);
    const user = await this.userModel
      .findOne({ _id: id, isActive: true })
      .exec();
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  /**
   * Incluye el campo password (select:false por defecto). Usado por auth.
   */
  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+password')
      .exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    user: AuthenticatedUser,
  ): Promise<UserDocument> {
    this.assertValidId(id);
    this.assertCanEdit(id, user);
    const updated = await this.userModel
      .findOneAndUpdate({ _id: id, isActive: true }, dto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return updated;
  }

  /**
   * Soft delete: marca isActive = false. Solo la propia cuenta (o un admin).
   */
  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    this.assertValidId(id);
    this.assertCanEdit(id, user);
    const result = await this.userModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { isActive: false },
        { new: true },
      )
      .exec();
    if (!result) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  async updateFcmToken(
    id: string,
    fcmToken: string,
    user: AuthenticatedUser,
  ): Promise<UserDocument> {
    this.assertValidId(id);
    this.assertCanEdit(id, user);
    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { fcmToken },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return updated;
  }

  async setHashedRefreshToken(
    id: string,
    hashedRefreshToken: string | null,
    refreshTokenExpiresAt: Date | null = null,
  ): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { hashedRefreshToken, refreshTokenExpiresAt })
      .exec();
  }

  /**
   * Guarda (o limpia) el código de recuperación de contraseña: el hash y su
   * expiración. Pasar `null` en ambos limpia el código (tras usarlo).
   */
  async setResetPasswordCode(
    id: string,
    resetPasswordCodeHash: string | null,
    resetPasswordCodeExpiresAt: Date | null,
  ): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        resetPasswordCodeHash,
        resetPasswordCodeExpiresAt,
      })
      .exec();
  }

  /**
   * Busca un usuario por email incluyendo el hash del código de recuperación
   * (que es `select:false`). Usado por auth al validar el código.
   */
  async findByEmailWithResetCode(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+resetPasswordCodeHash')
      .exec();
  }

  /**
   * Limpia (pone a null) el hash del refresh token de los usuarios cuya fecha de
   * expiración ya pasó. Devuelve cuántos se limpiaron. Usado por el cron de
   * mantenimiento de sesiones.
   */
  async cleanupExpiredRefreshTokens(): Promise<number> {
    const result = await this.userModel
      .updateMany(
        {
          hashedRefreshToken: { $ne: null },
          refreshTokenExpiresAt: { $ne: null, $lte: new Date() },
        },
        { hashedRefreshToken: null, refreshTokenExpiresAt: null },
      )
      .exec();
    return result.modifiedCount ?? 0;
  }

  async findByIdWithRefreshToken(id: string): Promise<UserDocument | null> {
    this.assertValidId(id);
    return this.userModel.findById(id).select('+hashedRefreshToken').exec();
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userModel.findByIdAndUpdate(id, { password: hashed }).exec();
  }

  /**
   * Cambia el rol de un usuario (operación de admin).
   */
  async changeRole(id: string, role: Role): Promise<UserDocument> {
    this.assertValidId(id);
    const user = await this.userModel
      .findOneAndUpdate({ _id: id, isActive: true }, { role }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  /**
   * Bloquea permanentemente la cuenta (usado por trust-score con 3+ strikes).
   */
  async block(id: string, blockedUntil: Date | null = null): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { isBlocked: true, blockedUntil })
      .exec();
  }

  async unblock(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { isBlocked: false, blockedUntil: null })
      .exec();
  }

  async addFavorite(id: string, hairstyleId: string): Promise<UserDocument> {
    this.assertValidId(id);
    this.assertValidId(hairstyleId, 'hairstyleId');
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { $addToSet: { favoriteStyles: new Types.ObjectId(hairstyleId) } },
        { new: true },
      )
      .exec();
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async getFavorites(id: string): Promise<UserDocument> {
    this.assertValidId(id);
    const user = await this.userModel
      .findOne({ _id: id, isActive: true })
      .populate('favoriteStyles')
      .exec();
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
