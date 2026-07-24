import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { extractId } from '../../common/utils';
import { CreateBarberDto } from './dto/create-barber.dto';
import { ScheduleSlotDto } from './dto/schedule-slot.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { Barber, BarberDocument } from './schemas/barber.schema';

@Injectable()
export class BarbersService {
  constructor(
    @InjectModel(Barber.name)
    private readonly barberModel: Model<BarberDocument>,
  ) {}

  /**
   * Verifica que el usuario pueda gestionar este perfil de barbero: el admin
   * puede gestionar cualquiera; un barbero solo el suyo (barber.user === userId).
   * Lanza ForbiddenException si no tiene permiso.
   */
  private async assertCanManage(
    barberId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.role === Role.ADMIN) {
      return;
    }
    const barber = await this.findById(barberId);
    if (extractId(barber.user) !== user.userId) {
      throw new ForbiddenException(
        'Solo puedes gestionar tu propio perfil de barbero',
      );
    }
  }

  async create(dto: CreateBarberDto): Promise<BarberDocument> {
    this.assertValidId(dto.user, 'user');
    const existing = await this.barberModel
      .findOne({ user: dto.user, isActive: true })
      .exec();
    if (existing) {
      throw new BadRequestException(
        'Este usuario ya tiene un perfil de barbero',
      );
    }
    return this.barberModel.create({
      ...dto,
      user: new Types.ObjectId(dto.user),
    });
  }

  /**
   * Garantiza que el usuario tenga un perfil de barbero activo. Si ya existe
   * uno (activo o desactivado), lo reactiva; si no existe, lo crea vacío.
   * Idempotente. Usado al ascender un usuario a rol barbero.
   */
  async ensureProfileForUser(userId: string): Promise<BarberDocument> {
    this.assertValidId(userId, 'userId');
    const userObjectId = new Types.ObjectId(userId);
    const existing = await this.barberModel
      .findOne({ user: userObjectId })
      .exec();
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        await existing.save();
      }
      return existing;
    }
    return this.barberModel.create({ user: userObjectId });
  }

  /**
   * Desactiva (soft delete) el perfil de barbero de un usuario, si lo tiene.
   * Idempotente: si no hay perfil, no hace nada. Usado al quitarle el rol
   * barbero a un usuario.
   */
  async deactivateForUser(userId: string): Promise<void> {
    this.assertValidId(userId, 'userId');
    await this.barberModel
      .updateOne(
        { user: new Types.ObjectId(userId), isActive: true },
        { isActive: false },
      )
      .exec();
  }

  async findAll(): Promise<BarberDocument[]> {
    return this.barberModel
      .find({ isActive: true })
      .populate('user', 'name avatar email')
      .sort({ rating: -1 })
      .exec();
  }

  async findById(id: string): Promise<BarberDocument> {
    this.assertValidId(id);
    const barber = await this.barberModel
      .findOne({ _id: id, isActive: true })
      .populate('user', 'name avatar email')
      .exec();
    if (!barber) {
      throw new NotFoundException('Barbero no encontrado');
    }
    return barber;
  }

  /**
   * Devuelve el perfil de barbero asociado a un User. Lo usa el propio barbero
   * para obtener su `barber._id` (necesario para editar perfil/horario/portafolio)
   * a partir del userId de su sesión.
   */
  async findByUserId(userId: string): Promise<BarberDocument> {
    this.assertValidId(userId, 'userId');
    const barber = await this.barberModel
      .findOne({ user: new Types.ObjectId(userId), isActive: true })
      .populate('user', 'name avatar email')
      .exec();
    if (!barber) {
      throw new NotFoundException(
        'No existe un perfil de barbero para este usuario',
      );
    }
    return barber;
  }

  async update(
    id: string,
    dto: UpdateBarberDto,
    user: AuthenticatedUser,
  ): Promise<BarberDocument> {
    this.assertValidId(id);
    await this.assertCanManage(id, user);
    const updated = await this.barberModel
      .findOneAndUpdate({ _id: id, isActive: true }, dto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Barbero no encontrado');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    this.assertValidId(id);
    const result = await this.barberModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { isActive: false },
        { new: true },
      )
      .exec();
    if (!result) {
      throw new NotFoundException('Barbero no encontrado');
    }
  }

  async getPortfolio(id: string): Promise<string[]> {
    const barber = await this.findById(id);
    return barber.portfolio;
  }

  async addPortfolioImage(
    id: string,
    imageUrl: string,
    user: AuthenticatedUser,
  ): Promise<BarberDocument> {
    this.assertValidId(id);
    await this.assertCanManage(id, user);
    const barber = await this.barberModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { $push: { portfolio: imageUrl } },
        { new: true },
      )
      .exec();
    if (!barber) {
      throw new NotFoundException('Barbero no encontrado');
    }
    return barber;
  }

  /**
   * Elimina una imagen del portafolio por su URL. Solo el dueño del perfil
   * (o un admin) puede hacerlo.
   */
  async removePortfolioImage(
    id: string,
    imageUrl: string,
    user: AuthenticatedUser,
  ): Promise<BarberDocument> {
    this.assertValidId(id);
    await this.assertCanManage(id, user);
    const barber = await this.barberModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { $pull: { portfolio: imageUrl } },
        { new: true },
      )
      .exec();
    if (!barber) {
      throw new NotFoundException('Barbero no encontrado');
    }
    return barber;
  }

  async getSchedule(id: string): Promise<BarberDocument['schedule']> {
    const barber = await this.findById(id);
    return barber.schedule;
  }

  async updateSchedule(
    id: string,
    schedule: ScheduleSlotDto[],
    user: AuthenticatedUser,
  ): Promise<BarberDocument> {
    this.assertValidId(id);
    await this.assertCanManage(id, user);
    const barber = await this.barberModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { schedule },
        { new: true },
      )
      .exec();
    if (!barber) {
      throw new NotFoundException('Barbero no encontrado');
    }
    return barber;
  }

  async getBarberOfTheDay(): Promise<BarberDocument | null> {
    return this.barberModel
      .findOne({ isActive: true, isBarberOfTheDay: true })
      .populate('user', 'name avatar email')
      .exec();
  }

  async setBarberOfTheDay(
    id: string,
    isBarberOfTheDay: boolean,
  ): Promise<BarberDocument> {
    this.assertValidId(id);
    if (isBarberOfTheDay) {
      // Solo puede haber uno.
      await this.barberModel
        .updateMany({ isBarberOfTheDay: true }, { isBarberOfTheDay: false })
        .exec();
    }
    const barber = await this.barberModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { isBarberOfTheDay },
        { new: true },
      )
      .exec();
    if (!barber) {
      throw new NotFoundException('Barbero no encontrado');
    }
    return barber;
  }

  /**
   * Recalcula rating y totalReviews. Usado por el módulo de reviews.
   */
  async updateRating(
    id: string,
    rating: number,
    totalReviews: number,
  ): Promise<void> {
    await this.barberModel
      .findByIdAndUpdate(id, { rating, totalReviews })
      .exec();
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
