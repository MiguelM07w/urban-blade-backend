import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { CreateCouponDto } from './dto/create-coupon.dto';
import {
  DiscountType,
  LEVEL_FREE_SERVICE_BONUS,
  LOYALTY_POINTS,
  LoyaltyLevel,
  resolveLevel,
  resolveLevelReached,
  VISITS_PER_FREE_SERVICE,
} from './enums/loyalty.enums';
import { Coupon, CouponDocument } from './schemas/coupon.schema';
import { Loyalty, LoyaltyDocument } from './schemas/loyalty.schema';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    @InjectModel(Loyalty.name)
    private readonly loyaltyModel: Model<LoyaltyDocument>,
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
  ) {}

  /**
   * Devuelve la ficha de fidelización del usuario, creándola con un código de
   * referido único si aún no existe.
   */
  async getOrCreate(userId: string): Promise<LoyaltyDocument> {
    this.assertValidId(userId, 'userId');
    const existing = await this.loyaltyModel
      .findOne({ user: new Types.ObjectId(userId) })
      .exec();
    if (existing) {
      return existing;
    }
    return this.loyaltyModel.create({
      user: new Types.ObjectId(userId),
      referralCode: this.generateReferralCode(),
    });
  }

  async findByUser(userId: string): Promise<LoyaltyDocument> {
    return this.getOrCreate(userId);
  }

  async getHistory(userId: string): Promise<LoyaltyDocument['history']> {
    const doc = await this.getOrCreate(userId);
    return doc.history;
  }

  /**
   * Devuelve los IDs (string) de usuarios que pertenecen a un nivel de
   * fidelización dado. Usado por promotions para segmentar audiencias.
   */
  async findUserIdsByLevel(level: LoyaltyLevel): Promise<string[]> {
    const docs = await this.loyaltyModel
      .find({ level })
      .select('user')
      .lean()
      .exec();
    return docs.map((d) => d.user.toString());
  }

  /**
   * Suma (o resta) puntos y registra el movimiento. Recalcula el nivel.
   * Método reutilizable por reviews, referidos, etc.
   */
  async addPoints(
    userId: string,
    points: number,
    action: string,
    description = '',
  ): Promise<LoyaltyDocument> {
    const doc = await this.getOrCreate(userId);
    doc.points = Math.max(0, doc.points + points);
    doc.level = resolveLevel(doc.points);
    doc.history.push({
      date: new Date(),
      action,
      pointsChanged: points,
      description,
    });
    // Otorga (una vez) el bono de servicios gratis si subió a oro/platino.
    this.grantLevelBenefits(doc);
    await doc.save();
    return doc;
  }

  /**
   * Registra una visita completada: suma puntos por cita (con bono de primera
   * cita si aplica), incrementa visitas y otorga servicios gratis cada N
   * visitas. Llamado por appointments al completar una cita.
   */
  async registerCompletedVisit(userId: string): Promise<LoyaltyDocument> {
    const doc = await this.getOrCreate(userId);

    const isFirstVisit = doc.totalVisits === 0;
    const earned =
      LOYALTY_POINTS.CITA_COMPLETADA +
      (isFirstVisit ? LOYALTY_POINTS.PRIMERA_CITA : 0);

    doc.totalVisits += 1;
    doc.points += earned;
    doc.level = resolveLevel(doc.points);
    doc.history.push({
      date: new Date(),
      action: 'cita_completada',
      pointsChanged: earned,
      description: isFirstVisit
        ? 'Primera cita completada (incluye bono de bienvenida)'
        : 'Cita completada',
    });

    // Servicio gratis cada VISITS_PER_FREE_SERVICE visitas.
    if (doc.totalVisits % VISITS_PER_FREE_SERVICE === 0) {
      doc.freeServicesEarned += 1;
      doc.history.push({
        date: new Date(),
        action: 'servicio_gratis',
        pointsChanged: 0,
        description: `Servicio gratis por alcanzar ${doc.totalVisits} visitas`,
      });
    }

    // Bono de servicios gratis si esta visita lo hizo subir a oro/platino.
    this.grantLevelBenefits(doc);

    await doc.save();
    return doc;
  }

  /**
   * Registra un referido exitoso: vincula referredBy y premia al referente.
   * Uso único: un usuario solo puede ser referido una vez. Devuelve el id del
   * referente y los puntos que ganó, para informar al frontend.
   */
  async applyReferral(
    newUserId: string,
    referralCode: string,
  ): Promise<{ referrerId: string; pointsAwarded: number }> {
    const referrer = await this.loyaltyModel
      .findOne({ referralCode: referralCode.trim().toUpperCase() })
      .exec();
    if (!referrer) {
      throw new NotFoundException('Código de referido no válido');
    }
    if (referrer.user.toString() === newUserId) {
      throw new BadRequestException(
        'No puedes usar tu propio código de referido',
      );
    }

    const newUserLoyalty = await this.getOrCreate(newUserId);
    if (newUserLoyalty.referredBy) {
      throw new BadRequestException('Ya usaste un código de referido antes');
    }

    newUserLoyalty.referredBy = referrer.user;
    await newUserLoyalty.save();

    referrer.totalReferrals += 1;
    await referrer.save();
    await this.addPoints(
      referrer.user.toString(),
      LOYALTY_POINTS.REFERIDO_EXITOSO,
      'referido_exitoso',
      'Referido exitoso',
    );

    return {
      referrerId: referrer.user.toString(),
      pointsAwarded: LOYALTY_POINTS.REFERIDO_EXITOSO,
    };
  }

  /**
   * Valida un código de referido (sin aplicarlo). Usado en onboarding.
   */
  async validateReferral(
    referralCode: string,
  ): Promise<{ valid: boolean; referrerId: string | null }> {
    const referrer = await this.loyaltyModel
      .findOne({ referralCode: referralCode.trim().toUpperCase() })
      .exec();
    return {
      valid: !!referrer,
      referrerId: referrer ? referrer.user.toString() : null,
    };
  }

  // ---- Cupones ----

  async createCoupon(dto: CreateCouponDto): Promise<CouponDocument> {
    const existing = await this.couponModel
      .findOne({ code: dto.code.toUpperCase() })
      .exec();
    if (existing) {
      throw new BadRequestException('Ya existe un cupón con ese código');
    }
    return this.couponModel.create({ ...dto, code: dto.code.toUpperCase() });
  }

  async listAvailableCoupons(): Promise<CouponDocument[]> {
    return this.couponModel
      .find({ isActive: true, expiresAt: { $gt: new Date() } })
      .sort({ expiresAt: 1 })
      .exec();
  }

  /**
   * Canjea un cupón para un usuario. Valida vigencia, usos, visitas requeridas
   * y que el usuario no lo haya usado ya.
   */
  async redeemCoupon(userId: string, code: string): Promise<CouponDocument> {
    this.assertValidId(userId, 'userId');
    const coupon = await this.couponModel
      .findOne({ code: code.toUpperCase(), isActive: true })
      .exec();
    if (!coupon) {
      throw new NotFoundException('Cupón no encontrado o inactivo');
    }
    if (coupon.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('El cupón ha expirado');
    }
    if (coupon.usedBy.length >= coupon.maxUses) {
      throw new BadRequestException('El cupón alcanzó su límite de usos');
    }
    const userObjectId = new Types.ObjectId(userId);
    if (coupon.usedBy.some((u) => u.equals(userObjectId))) {
      throw new BadRequestException('Ya usaste este cupón');
    }
    if (coupon.claimedBy.some((u) => u.equals(userObjectId))) {
      throw new BadRequestException('Ya tienes este cupón disponible');
    }

    // Verifica visitas mínimas requeridas.
    if (coupon.minVisitsRequired > 0) {
      const loyalty = await this.getOrCreate(userId);
      if (loyalty.totalVisits < coupon.minVisitsRequired) {
        throw new BadRequestException(
          `Necesitas al menos ${coupon.minVisitsRequired} visitas para este cupón`,
        );
      }
    }

    // Reclamar (no consumir): el cupón queda DISPONIBLE para el usuario. Se marca
    // como usado recién cuando se aplica a una cita completada (markCouponUsed).
    coupon.claimedBy.push(userObjectId);
    await coupon.save();
    this.logger.log(`Cupón ${coupon.code} reclamado por ${userId}`);
    return coupon;
  }

  /**
   * Evalúa un cupón para un usuario y un precio SIN consumirlo. Devuelve el
   * cupón, el descuento en dinero que aplicaría sobre `price`, y un `error` con
   * el motivo si no es aplicable (en vez de lanzar excepción, para que el quote
   * lo muestre). Usado por appointments al cotizar con cupón.
   *
   * `price` debe ser el precio YA con la promoción aplicada (el cupón se calcula
   * sobre ese importe, de modo que promo y cupón se acumulan).
   */
  async quoteCoupon(
    userId: string,
    code: string,
    price: number,
  ): Promise<{
    coupon: CouponDocument | null;
    discount: number;
    error: string | null;
  }> {
    const none = { coupon: null, discount: 0 };
    if (!Types.ObjectId.isValid(userId)) {
      return { ...none, error: 'Usuario no válido' };
    }
    const coupon = await this.couponModel
      .findOne({ code: code.trim().toUpperCase(), isActive: true })
      .exec();
    if (!coupon) {
      return { ...none, error: 'Cupón no encontrado o inactivo' };
    }
    if (coupon.expiresAt.getTime() <= Date.now()) {
      return { ...none, error: 'El cupón ha expirado' };
    }
    if (coupon.usedBy.length >= coupon.maxUses) {
      return { ...none, error: 'El cupón alcanzó su límite de usos' };
    }
    const userObjectId = new Types.ObjectId(userId);
    if (coupon.usedBy.some((u) => u.equals(userObjectId))) {
      return { ...none, error: 'Ya usaste este cupón' };
    }
    if (coupon.minVisitsRequired > 0) {
      const loyalty = await this.getOrCreate(userId);
      if (loyalty.totalVisits < coupon.minVisitsRequired) {
        return {
          ...none,
          error: `Necesitas al menos ${coupon.minVisitsRequired} visitas para este cupón`,
        };
      }
    }

    const discount = this.couponDiscount(coupon, price);
    return { coupon, discount, error: null };
  }

  /**
   * Devuelve un cupón que el usuario tiene RECLAMADO y sin usar (canjeado en
   * Fidelización, aún no aplicado a una cita), vigente y con usos disponibles.
   * Se usa para auto-aplicarlo al cotizar una cita sin que el front lo mande. Si
   * hay varios, devuelve el más reciente. `null` si no tiene ninguno.
   */
  async findClaimedUnusedCoupon(
    userId: string,
  ): Promise<CouponDocument | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }
    const userObjectId = new Types.ObjectId(userId);
    return this.couponModel
      .findOne({
        isActive: true,
        claimedBy: userObjectId,
        usedBy: { $ne: userObjectId },
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Descuento en dinero de un cupón sobre un precio dado, según su tipo.
   * Nunca supera el precio (no deja negativo).
   */
  private couponDiscount(coupon: CouponDocument, price: number): number {
    let discount = 0;
    switch (coupon.discountType) {
      case DiscountType.PORCENTAJE:
        discount = (price * coupon.discountValue) / 100;
        break;
      case DiscountType.MONTO_FIJO:
        discount = coupon.discountValue;
        break;
      case DiscountType.SERVICIO_GRATIS:
        discount = price;
        break;
    }
    return Math.min(Math.max(discount, 0), price);
  }

  /**
   * Marca un cupón como usado por un usuario (lo consume). Idempotente: si ya
   * estaba registrado, no lo duplica. Llamado al completar la cita, no al
   * reservar.
   */
  async markCouponUsed(couponId: string, userId: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    // Consume el cupón: lo marca usado y lo saca de "reclamados" (si estaba).
    await this.couponModel
      .updateOne(
        { _id: new Types.ObjectId(couponId) },
        {
          $addToSet: { usedBy: userObjectId },
          $pull: { claimedBy: userObjectId },
        },
      )
      .exec();
  }

  /**
   * Canjea un servicio gratis acumulado (por cada 10 visitas). Descuenta uno del
   * contador `freeServicesEarned` de forma atómica (solo si hay disponible) para
   * evitar dobles canjes, y registra el movimiento. Devuelve la ficha con
   * `freeServicesEarned` ya actualizado. Si no tiene ninguno, lanza 400.
   */
  async redeemFreeService(userId: string): Promise<LoyaltyDocument> {
    this.assertValidId(userId, 'userId');
    // Descuento atómico condicionado a que quede al menos 1 disponible.
    const updated = await this.loyaltyModel
      .findOneAndUpdate(
        {
          user: new Types.ObjectId(userId),
          freeServicesEarned: { $gt: 0 },
        },
        {
          $inc: { freeServicesEarned: -1 },
          $push: {
            history: {
              date: new Date(),
              action: 'servicio_gratis_canjeado',
              pointsChanged: 0,
              description: 'Servicio gratis canjeado',
            },
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      // O no tiene ficha, o no tiene servicios gratis disponibles.
      await this.getOrCreate(userId);
      throw new BadRequestException(
        'No tienes servicios gratis disponibles para canjear',
      );
    }

    this.logger.log(`Servicio gratis canjeado por ${userId}`);
    return updated;
  }

  /**
   * Otorga (una sola vez) los bonos de servicios gratis por alcanzar niveles.
   * Revisa todos los niveles cuyo umbral ya superó el usuario y que aún no
   * hayan premiado; suma su bono a `freeServicesEarned` y los marca como
   * reclamados. Muta el documento (NO lo guarda: lo guarda el llamador). Es
   * idempotente: un nivel ya reclamado nunca vuelve a premiar.
   *
   * Si el usuario salta varios niveles de golpe (p. ej. de plata a platino),
   * recibe los bonos de todos los niveles intermedios con beneficio.
   */
  private grantLevelBenefits(doc: LoyaltyDocument): void {
    for (const level of Object.values(LoyaltyLevel)) {
      const bonus = LEVEL_FREE_SERVICE_BONUS[level];
      if (bonus <= 0) {
        continue; // bronce/plata no dan bono
      }
      if (doc.claimedLevelBenefits.includes(level)) {
        continue; // ya se otorgó este nivel
      }
      // ¿El usuario tiene puntos suficientes para este nivel?
      if (resolveLevelReached(doc.points, level)) {
        doc.freeServicesEarned += bonus;
        doc.claimedLevelBenefits.push(level);
        doc.history.push({
          date: new Date(),
          action: 'beneficio_nivel',
          pointsChanged: 0,
          description: `Beneficio por alcanzar nivel ${level}: ${bonus} servicio(s) gratis`,
        });
        this.logger.log(
          `Usuario ${doc.user.toString()} obtuvo ${bonus} servicio(s) gratis por nivel ${level}`,
        );
      }
    }
  }

  /**
   * Genera un código de referido corto y único (derivado de un uuid).
   */
  private generateReferralCode(): string {
    return uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
