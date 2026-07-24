import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { extractId } from '../../common/utils';
import { BarbersService } from '../barbers/barbers.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { AppointmentStatus } from '../appointments/enums/appointment.enums';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { LOYALTY_POINTS } from '../loyalty/enums/loyalty.enums';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review, ReviewDocument } from './schemas/review.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly appointmentsService: AppointmentsService,
    private readonly barbersService: BarbersService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  /**
   * Crea una reseña. Reglas:
   *  - La cita debe existir, pertenecer al cliente y estar completada.
   *  - Sólo una reseña por cita (índice único + verificación previa).
   *  - Al crear: recalcula el rating del barbero y suma +10 pts de loyalty.
   */
  async create(
    clientId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewDocument> {
    const appointment = await this.appointmentsService.findById(
      dto.appointment,
    );

    if (extractId(appointment.client) !== clientId) {
      throw new ForbiddenException('Esta cita no te pertenece');
    }
    if (appointment.status !== AppointmentStatus.COMPLETADA) {
      throw new BadRequestException('Solo puedes reseñar citas completadas');
    }

    const existing = await this.reviewModel
      .findOne({ appointment: new Types.ObjectId(dto.appointment) })
      .exec();
    if (existing) {
      throw new BadRequestException('Esta cita ya tiene una reseña');
    }

    const review = await this.reviewModel.create({
      client: new Types.ObjectId(clientId),
      barber: appointment.barber,
      appointment: new Types.ObjectId(dto.appointment),
      rating: dto.rating,
      comment: dto.comment ?? '',
      photos: dto.photos ?? [],
    });

    // Actualiza el promedio del barbero y premia al cliente.
    await this.recalculateBarberRating(extractId(appointment.barber));
    await this.loyaltyService.addPoints(
      clientId,
      LOYALTY_POINTS.RESENA_COMPLETADA,
      'resena_completada',
      `Reseña de la cita ${appointment.id}`,
    );

    return review;
  }

  async findAll(): Promise<ReviewDocument[]> {
    return this.reviewModel
      .find({ isVisible: true })
      .populate('client', 'name avatar')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByBarber(barberId: string): Promise<ReviewDocument[]> {
    this.assertValidId(barberId, 'barberId');
    return this.reviewModel
      .find({ barber: new Types.ObjectId(barberId), isVisible: true })
      .populate('client', 'name avatar')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(id: string): Promise<ReviewDocument> {
    this.assertValidId(id);
    const review = await this.reviewModel.findById(id).exec();
    if (!review) {
      throw new NotFoundException('Reseña no encontrada');
    }
    return review;
  }

  /**
   * Edita una reseña. Solo el autor puede hacerlo. Si cambia el rating, se
   * recalcula el promedio del barbero.
   */
  async update(
    id: string,
    clientId: string,
    dto: UpdateReviewDto,
  ): Promise<ReviewDocument> {
    const review = await this.findById(id);
    if (review.client.toString() !== clientId) {
      throw new ForbiddenException('No puedes editar una reseña ajena');
    }

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.comment !== undefined) review.comment = dto.comment;
    if (dto.photos !== undefined) review.photos = dto.photos;
    await review.save();

    if (dto.rating !== undefined) {
      await this.recalculateBarberRating(review.barber.toString());
    }
    return review;
  }

  /**
   * Elimina una reseña (autor o admin). Se implementa como ocultación
   * (isVisible=false) para conservar el histórico, y recalcula el rating.
   */
  async remove(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const review = await this.findById(id);
    if (!isAdmin && review.client.toString() !== requesterId) {
      throw new ForbiddenException('No puedes eliminar una reseña ajena');
    }
    review.isVisible = false;
    await review.save();
    await this.recalculateBarberRating(review.barber.toString());
  }

  /**
   * Recalcula rating (promedio) y totalReviews del barbero a partir de sus
   * reseñas visibles, y lo persiste en el módulo de barbers.
   */
  private async recalculateBarberRating(barberId: string): Promise<void> {
    const stats = await this.reviewModel
      .aggregate<{ avg: number; count: number }>([
        {
          $match: {
            barber: new Types.ObjectId(barberId),
            isVisible: true,
          },
        },
        {
          $group: {
            _id: '$barber',
            avg: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const avg = stats.length > 0 ? Math.round(stats[0].avg * 10) / 10 : 0;
    const count = stats.length > 0 ? stats[0].count : 0;
    await this.barbersService.updateRating(barberId, avg, count);
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
