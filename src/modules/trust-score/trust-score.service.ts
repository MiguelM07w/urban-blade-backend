import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import {
  TRUST_SCORE_DEFAULT,
  TRUST_SCORE_MAX,
  TRUST_SCORE_MAX_STRIKES,
  TRUST_SCORE_MIN,
  TRUST_SCORE_POINTS,
  TRUST_SCORE_RESTRICTION_DAYS,
  TRUST_SCORE_RESTRICTION_THRESHOLD,
  TrustScoreAction,
} from './enums/trust-score.enums';
import {
  TrustScore,
  TrustScoreDocument,
} from './schemas/trust-score.schema';

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

  constructor(
    @InjectModel(TrustScore.name)
    private readonly trustScoreModel: Model<TrustScoreDocument>,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  /**
   * Devuelve el trust score del usuario, creándolo con valores por defecto
   * si aún no existe.
   */
  async getOrCreate(userId: string): Promise<TrustScoreDocument> {
    this.assertValidId(userId);
    const existing = await this.trustScoreModel
      .findOne({ user: new Types.ObjectId(userId) })
      .exec();
    if (existing) {
      return existing;
    }
    return this.trustScoreModel.create({
      user: new Types.ObjectId(userId),
      score: TRUST_SCORE_DEFAULT,
    });
  }

  async findByUser(userId: string): Promise<TrustScoreDocument> {
    this.assertValidId(userId);
    const doc = await this.trustScoreModel
      .findOne({ user: new Types.ObjectId(userId) })
      .exec();
    if (!doc) {
      throw new NotFoundException(
        'No existe trust score para este usuario todavía',
      );
    }
    return doc;
  }

  async getHistory(
    userId: string,
  ): Promise<TrustScoreDocument['history']> {
    const doc = await this.findByUser(userId);
    return doc.history;
  }

  /**
   * Indica si el usuario puede reservar (score suficiente y sin restricción
   * vigente). Usado por el TrustScoreGuard.
   */
  async canBook(userId: string): Promise<boolean> {
    const doc = await this.getOrCreate(userId);
    if (doc.isRestricted && doc.restrictedUntil) {
      if (doc.restrictedUntil.getTime() > Date.now()) {
        return false;
      }
      // La restricción expiró: la levantamos.
      doc.isRestricted = false;
      doc.restrictedUntil = null;
      await doc.save();
    }
    return doc.score >= TRUST_SCORE_RESTRICTION_THRESHOLD;
  }

  /**
   * Registra una acción, ajusta el score, aplica strikes/restricciones y
   * bloquea la cuenta si corresponde. Es el punto de entrada usado por
   * appointments.
   */
  async registerAction(
    userId: string,
    action: TrustScoreAction,
    description = '',
  ): Promise<TrustScoreDocument> {
    const doc = await this.getOrCreate(userId);
    const points = TRUST_SCORE_POINTS[action];

    doc.score = this.clamp(doc.score + points);
    doc.history.push({
      date: new Date(),
      action,
      pointsChanged: points,
      description,
    });

    if (action === TrustScoreAction.NO_ASISTIO) {
      doc.strikes += 1;
    }

    // Restricción temporal por score bajo.
    if (doc.score < TRUST_SCORE_RESTRICTION_THRESHOLD) {
      doc.isRestricted = true;
      doc.restrictedUntil = this.addDays(
        new Date(),
        TRUST_SCORE_RESTRICTION_DAYS,
      );
    }

    await doc.save();

    // Bloqueo permanente por acumulación de strikes.
    if (doc.strikes >= TRUST_SCORE_MAX_STRIKES) {
      await this.usersService.block(userId, null);
      this.logger.warn(
        `Usuario ${userId} bloqueado permanentemente por ${doc.strikes} strikes`,
      );
    }

    return doc;
  }

  /**
   * Restauración manual por parte de un admin: resetea score, strikes y
   * restricciones, y desbloquea la cuenta.
   */
  async restore(userId: string): Promise<TrustScoreDocument> {
    const doc = await this.getOrCreate(userId);
    doc.score = TRUST_SCORE_DEFAULT;
    doc.strikes = 0;
    doc.isRestricted = false;
    doc.restrictedUntil = null;
    doc.history.push({
      date: new Date(),
      action: TrustScoreAction.CITA_COMPLETADA,
      pointsChanged: 0,
      description: 'Restauración manual por administrador',
    });
    await doc.save();
    await this.usersService.unblock(userId);
    return doc;
  }

  private clamp(value: number): number {
    return Math.max(TRUST_SCORE_MIN, Math.min(TRUST_SCORE_MAX, value));
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('El userId proporcionado no es válido');
    }
  }
}
