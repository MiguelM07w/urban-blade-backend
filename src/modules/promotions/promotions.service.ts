import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { extractId } from '../../common/utils';
import { Role } from '../../common/enums';
import { LoyaltyLevel } from '../loyalty/enums/loyalty.enums';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { ServiceCategory } from '../services/enums/service-category.enum';
import { UsersService } from '../users/users.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import {
  PromotionScope,
  PromotionType,
  TargetAudience,
} from './enums/promotion.enums';
import { Promotion, PromotionDocument } from './schemas/promotion.schema';
import {
  PromotionRedemption,
  PromotionRedemptionDocument,
} from './schemas/promotion-redemption.schema';

/**
 * Contexto de un servicio para evaluar qué promoción aplica y calcular precio.
 */
export interface PromotionPriceContext {
  serviceId: string;
  category: ServiceCategory;
  basePrice: number;
  isFirstAppointment: boolean;
  // Cliente para el que se cotiza. Si se indica, se excluyen las promociones
  // que ese cliente ya haya usado (uso único por usuario).
  clientId?: string;
}

/**
 * Resultado de aplicar la mejor promoción a un servicio.
 */
export interface PromotionQuote {
  basePrice: number;
  discount: number;
  finalPrice: number;
  promotion: {
    id: string;
    title: string;
    type: PromotionType;
    discountValue: number;
    scope: PromotionScope;
  } | null;
}

/** Días de antigüedad máxima para considerar a un usuario "nuevo cliente". */
const NEW_CLIENT_WINDOW_DAYS = 30;

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    @InjectModel(Promotion.name)
    private readonly promotionModel: Model<PromotionDocument>,
    @InjectModel(PromotionRedemption.name)
    private readonly redemptionModel: Model<PromotionRedemptionDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly loyaltyService: LoyaltyService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreatePromotionDto): Promise<PromotionDocument> {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio',
      );
    }
    return this.promotionModel.create(dto);
  }

  /**
   * Lista solo promociones activas y vigentes (dentro del rango de fechas).
   */
  async findAllActive(): Promise<PromotionDocument[]> {
    const now = new Date();
    return this.promotionModel
      .find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
      .sort({ endDate: 1 })
      .exec();
  }

  /**
   * Calcula el mejor precio para un servicio aplicando la promoción vigente más
   * ventajosa (mayor descuento). No acumula promociones. Si ninguna aplica,
   * devuelve el precio base sin descuento.
   */
  async quoteForService(ctx: PromotionPriceContext): Promise<PromotionQuote> {
    const active = await this.findAllActive();

    // Promociones que este cliente ya usó (uso único por usuario): se excluyen.
    const redeemedIds = ctx.clientId
      ? await this.redeemedPromotionIds(ctx.clientId)
      : new Set<string>();

    let best: PromotionDocument | null = null;
    let bestDiscount = 0;

    for (const promo of active) {
      if (redeemedIds.has(promo.id)) {
        continue;
      }
      if (!this.appliesToService(promo, ctx)) {
        continue;
      }
      const discount = this.discountFor(promo, ctx.basePrice);
      if (discount > bestDiscount) {
        bestDiscount = discount;
        best = promo;
      }
    }

    // Redondea a 2 decimales y nunca deja precio negativo.
    const discount = Math.min(
      Math.round(bestDiscount * 100) / 100,
      ctx.basePrice,
    );
    const finalPrice = Math.round((ctx.basePrice - discount) * 100) / 100;

    return {
      basePrice: ctx.basePrice,
      discount,
      finalPrice,
      promotion: best
        ? {
            id: best.id,
            title: best.title,
            type: best.type,
            discountValue: best.discountValue,
            scope: best.scope,
          }
        : null,
    };
  }

  /**
   * IDs (string) de las promociones que un cliente ya ha redimido.
   */
  private async redeemedPromotionIds(clientId: string): Promise<Set<string>> {
    const docs = await this.redemptionModel
      .find({ user: new Types.ObjectId(clientId) })
      .select('promotion')
      .lean()
      .exec();
    return new Set(docs.map((d) => d.promotion.toString()));
  }

  /**
   * Registra que un cliente usó una promoción (uso único). Idempotente: si ya
   * existía la redención, no falla (el índice único la protege). Devuelve true
   * si quedó registrada (o ya lo estaba).
   */
  async registerRedemption(
    promotionId: string,
    clientId: string,
    ticketId?: string,
  ): Promise<boolean> {
    try {
      await this.redemptionModel.create({
        promotion: new Types.ObjectId(promotionId),
        user: new Types.ObjectId(clientId),
        ticket: ticketId ? new Types.ObjectId(ticketId) : null,
      });
      return true;
    } catch (error) {
      // Código 11000 = clave duplicada: el cliente ya había usado esta promo.
      if ((error as { code?: number }).code === 11000) {
        return true;
      }
      this.logger.warn(
        `No se pudo registrar la redención de la promo ${promotionId} para ${clientId}: ${
          (error as Error).message
        }`,
      );
      return false;
    }
  }

  /**
   * ¿La promoción aplica a este servicio/contexto según su scope?
   */
  private appliesToService(
    promo: PromotionDocument,
    ctx: PromotionPriceContext,
  ): boolean {
    switch (promo.scope) {
      case PromotionScope.CATEGORIA:
        return promo.category === ctx.category;
      case PromotionScope.SERVICIOS:
        return promo.services.some((s) => extractId(s) === ctx.serviceId);
      case PromotionScope.PRIMERA_CITA:
        return ctx.isFirstAppointment;
      case PromotionScope.TODOS:
      default:
        return true;
    }
  }

  /**
   * Descuento en dinero que aplica una promoción sobre un precio base.
   * - descuento:       discountValue es un porcentaje (0-100).
   * - servicio_gratis: el precio final es 0 (descuento = precio completo).
   * - combo:           publicitario, sin descuento directo sobre un servicio.
   */
  private discountFor(promo: PromotionDocument, basePrice: number): number {
    switch (promo.type) {
      case PromotionType.SERVICIO_GRATIS:
        return basePrice;
      case PromotionType.DESCUENTO: {
        const pct = Math.min(Math.max(promo.discountValue, 0), 100);
        return (basePrice * pct) / 100;
      }
      case PromotionType.COMBO:
      default:
        return 0;
    }
  }

  async findById(id: string): Promise<PromotionDocument> {
    this.assertValidId(id);
    const promotion = await this.promotionModel.findById(id).exec();
    if (!promotion) {
      throw new NotFoundException('Promoción no encontrada');
    }
    return promotion;
  }

  async update(
    id: string,
    dto: UpdatePromotionDto,
  ): Promise<PromotionDocument> {
    this.assertValidId(id);
    const updated = await this.promotionModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Promoción no encontrada');
    }
    return updated;
  }

  /**
   * Soft delete: desactiva la promoción.
   */
  async remove(id: string): Promise<void> {
    this.assertValidId(id);
    const result = await this.promotionModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .exec();
    if (!result) {
      throw new NotFoundException('Promoción no encontrada');
    }
  }

  /**
   * Envía la notificación push de una promoción a la audiencia objetivo.
   * Resuelve los destinatarios según targetAudience y crea una notificación
   * por cada uno. Devuelve cuántos usuarios fueron notificados.
   */
  async notify(promotionId: string): Promise<{ notified: number }> {
    const promotion = await this.findById(promotionId);
    const recipientIds = await this.resolveAudience(promotion.targetAudience);

    await Promise.all(
      recipientIds.map((userId) =>
        this.notificationsService.createForUser({
          userId,
          title: promotion.title,
          body: promotion.description || '¡Tenemos una promoción para ti!',
          type: NotificationType.PROMOCION,
          data: { promotionId: promotion.id },
        }),
      ),
    );

    this.logger.log(
      `Promoción ${promotion.id} notificada a ${recipientIds.length} usuarios`,
    );
    return { notified: recipientIds.length };
  }

  /**
   * Traduce el público objetivo a una lista concreta de IDs de usuario.
   */
  private async resolveAudience(audience: TargetAudience): Promise<string[]> {
    switch (audience) {
      case TargetAudience.NIVEL_ORO:
        return this.loyaltyService.findUserIdsByLevel(LoyaltyLevel.ORO);
      case TargetAudience.NIVEL_PLATINO:
        return this.loyaltyService.findUserIdsByLevel(LoyaltyLevel.PLATINO);
      case TargetAudience.NUEVOS_CLIENTES: {
        const since = new Date();
        since.setDate(since.getDate() - NEW_CLIENT_WINDOW_DAYS);
        return this.usersService.findActiveIdsRegisteredSince(since);
      }
      case TargetAudience.TODOS:
      default:
        // Solo clientes: el staff (admin/barberos) no recibe promociones.
        return this.usersService.findActiveIdsByRole(Role.CLIENT);
    }
  }

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('El id proporcionado no es válido');
    }
  }
}
