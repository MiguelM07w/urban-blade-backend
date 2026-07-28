import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { extractId } from '../../common/utils';
import { Role } from '../../common/enums';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { BarbersService } from '../barbers/barbers.service';
import { BarberDocument } from '../barbers/schemas/barber.schema';
import { DayOfWeek } from '../barbers/enums/day-of-week.enum';
import { BarbershopConfigService } from '../barbershop-config/barbershop-config.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { PaymentMethod } from '../payments/enums/payment.enums';
import { PaymentsService } from '../payments/payments.service';
import {
  PromotionQuote,
  PromotionsService,
} from '../promotions/promotions.service';
import { ServicesService } from '../services/services.service';
import { TicketsService } from '../tickets/tickets.service';
import { TrustScoreAction } from '../trust-score/enums/trust-score.enums';
import { TrustScoreService } from '../trust-score/trust-score.service';
import { UsersService } from '../users/users.service';
import { WaitingListService } from '../waiting-list/waiting-list.service';
import { WalkInDto } from './dto/walk-in.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { AppointmentStatus, CancelledBy } from './enums/appointment.enums';
import { Appointment, AppointmentDocument } from './schemas/appointment.schema';
import {
  addMinutesToTime,
  calendarRange,
  combineDateAndTime,
  dayOfWeekUTC,
  dayRange,
  isTodayServer,
  minutesToTime,
  timeToMinutes,
} from './utils/time.util';

/**
 * Ventana de confirmación por defecto (horas). Se usa como respaldo si no se
 * puede leer la configuración de la barbería.
 */
const DEFAULT_CONFIRMATION_WINDOW_HOURS = 2;

/**
 * Datos del cupón aplicado en una cotización (o null si no se pidió / no aplica).
 */
export interface QuoteCoupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  discount: number; // dinero descontado por el cupón
  autoApplied: boolean; // true si lo aplicó el backend solo (cupón reclamado)
}

/**
 * Servicio gratis aplicado a la cotización (beneficio de fidelización: el usuario
 * tiene servicios gratis acumulados por nivel/visitas). Cuando aplica, el precio
 * final es 0 y se ignora promoción/cupón.
 */
export interface QuoteFreeService {
  applied: true;
  reason: string; // motivo legible (p. ej. "servicio gratis por fidelización")
}

/**
 * Cotización completa de una cita: promoción + cupón (ambos acumulables) sobre
 * el precio del servicio, o un servicio gratis que los reemplaza. Extiende el
 * resultado de promociones.
 */
export interface AppointmentQuote extends PromotionQuote {
  coupon: QuoteCoupon | null;
  couponError: string | null;
  freeService: QuoteFreeService | null;
}

/** Mapea el getDay() de JS (0=domingo) al enum DayOfWeek. */
const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  0: DayOfWeek.DOMINGO,
  1: DayOfWeek.LUNES,
  2: DayOfWeek.MARTES,
  3: DayOfWeek.MIERCOLES,
  4: DayOfWeek.JUEVES,
  5: DayOfWeek.VIERNES,
  6: DayOfWeek.SABADO,
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    private readonly servicesService: ServicesService,
    @Inject(forwardRef(() => BarbersService))
    private readonly barbersService: BarbersService,
    private readonly ticketsService: TicketsService,
    private readonly trustScoreService: TrustScoreService,
    private readonly loyaltyService: LoyaltyService,
    private readonly notificationsService: NotificationsService,
    private readonly waitingListService: WaitingListService,
    @Inject(forwardRef(() => BarbershopConfigService))
    private readonly configService: BarbershopConfigService,
    @Inject(forwardRef(() => PromotionsService))
    private readonly promotionsService: PromotionsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Cotiza el precio de un servicio para un cliente aplicando la mejor promoción
   * vigente (por categoría, servicio, primera cita o global). Devuelve el precio
   * base, el descuento y el precio final, más la promoción aplicada (si hubo).
   */
  async quote(
    serviceId: string,
    clientId?: string,
    excludeAppointmentId?: string,
    couponCode?: string,
  ): Promise<AppointmentQuote> {
    const service = await this.servicesService.findById(serviceId);
    // "Primera cita" = el cliente no tiene NINGUNA otra cita (de cualquier
    // estado). Así una 2ª reserva ya no califica aunque la 1ª no se haya
    // completado. Se excluye una cita concreta (p. ej. la que se completa ahora).
    const isFirstAppointment = clientId
      ? !(await this.hasPreviousAppointment(clientId, excludeAppointmentId))
      : false;

    // 1) Mejor promoción vigente (sobre el precio base).
    const promoQuote = await this.promotionsService.quoteForService({
      serviceId: service.id,
      category: service.category,
      basePrice: service.price,
      isFirstAppointment,
      clientId,
    });

    // 0) SERVICIO GRATIS por fidelización: si el usuario tiene uno disponible,
    //    gana sobre todo (precio 0) y se ignora promoción/cupón. Se detecta solo
    //    en el servidor (mismo patrón que "primera cita", sin que el front mande nada).
    if (clientId && (await this.hasFreeServiceAvailable(clientId))) {
      return {
        basePrice: service.price,
        discount: service.price,
        finalPrice: 0,
        promotion: null,
        coupon: null,
        couponError: null,
        freeService: {
          applied: true,
          reason: 'Servicio gratis por fidelización',
        },
      };
    }

    // 2) Cupón. Se acumula con la promo (se calcula sobre el precio YA con promo).
    //    Si el front manda un código manual, se usa ese; si no, se auto-detecta un
    //    cupón que el usuario tenga RECLAMADO y sin usar (canjeado en Fidelización).
    let coupon: QuoteCoupon | null = null;
    let couponError: string | null = null;
    let couponDiscount = 0;

    const trimmedCode = couponCode?.trim();
    let codeToApply = trimmedCode;
    let autoApplied = false;
    if (!codeToApply && clientId) {
      const claimed =
        await this.loyaltyService.findClaimedUnusedCoupon(clientId);
      if (claimed) {
        codeToApply = claimed.code;
        autoApplied = true;
      }
    }

    if (codeToApply && clientId) {
      const result = await this.loyaltyService.quoteCoupon(
        clientId,
        codeToApply,
        promoQuote.finalPrice,
      );
      if (result.error || !result.coupon) {
        // Un cupón manual inválido se reporta; uno auto-detectado inválido se
        // ignora en silencio (no molesta al usuario con un error que no pidió).
        couponError = autoApplied ? null : (result.error ?? 'Cupón no válido');
      } else {
        couponDiscount = result.discount;
        coupon = {
          id: result.coupon.id,
          code: result.coupon.code,
          discountType: result.coupon.discountType,
          discountValue: result.coupon.discountValue,
          discount: couponDiscount,
          autoApplied,
        };
      }
    } else if (trimmedCode && !clientId) {
      couponError = 'Debes iniciar sesión para aplicar un cupón';
    }

    // 3) Precio final = base − descuento promo − descuento cupón (nunca < 0).
    const totalDiscount = Math.min(
      Math.round((promoQuote.discount + couponDiscount) * 100) / 100,
      service.price,
    );
    const finalPrice = Math.round((service.price - totalDiscount) * 100) / 100;

    return {
      basePrice: promoQuote.basePrice,
      discount: totalDiscount,
      finalPrice,
      promotion: promoQuote.promotion,
      coupon,
      couponError,
      freeService: null,
    };
  }

  /** Indica si el usuario tiene al menos un servicio gratis de fidelización. */
  private async hasFreeServiceAvailable(clientId: string): Promise<boolean> {
    try {
      const loyalty = await this.loyaltyService.getOrCreate(clientId);
      return loyalty.freeServicesEarned > 0;
    } catch {
      return false;
    }
  }

  /**
   * Indica si el cliente ya tiene alguna cita registrada (de cualquier estado:
   * pendiente, confirmada, completada, cancelada o no_asistió). Usado para
   * decidir si una reserva cuenta como "primera cita". Permite excluir una cita
   * concreta (p. ej. la que se está completando en ese momento).
   */
  private async hasPreviousAppointment(
    clientId: string,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    this.assertValidId(clientId, 'clientId');
    const filter: Record<string, unknown> = {
      client: new Types.ObjectId(clientId),
    };
    if (excludeAppointmentId) {
      filter._id = { $ne: new Types.ObjectId(excludeAppointmentId) };
    }
    const count = await this.appointmentModel.countDocuments(filter).exec();
    return count > 0;
  }

  /**
   * Lee la ventana de cancelación/confirmación (horas) desde la configuración
   * de la barbería. Si falla, usa el valor por defecto.
   */
  private async getConfirmationWindowHours(): Promise<number> {
    try {
      return await this.configService.getCancellationWindowHours();
    } catch {
      return DEFAULT_CONFIRMATION_WINDOW_HOURS;
    }
  }

  async create(
    clientId: string,
    dto: CreateAppointmentDto,
  ): Promise<AppointmentDocument> {
    const service = await this.servicesService.findById(dto.service);
    const barber = await this.barbersService.findById(dto.barber);

    // No se puede reservar en el pasado (p. ej. hoy a una hora que ya pasó).
    this.assertNotInPast(dto.date, dto.startTime);

    // La duración del servicio determina la hora de fin.
    const endTime = addMinutesToTime(dto.startTime, service.duration);

    // El barbero debe trabajar ese día y el rango [inicio, fin] debe caber
    // completo dentro de alguna de sus franjas disponibles (soporta varias
    // franjas por día, p. ej. mañana y tarde con descanso en medio).
    const dayEnum = JS_DAY_TO_ENUM[dayOfWeekUTC(dto.date)];
    if (
      !this.fitsInSchedule(barber.schedule, dayEnum, dto.startTime, endTime)
    ) {
      throw new BadRequestException(
        'La hora solicitada está fuera del horario del barbero o cae en su descanso',
      );
    }

    // Evitar solapamiento con otras citas activas del barbero ese día.
    await this.assertNoOverlap(dto.barber, dto.date, dto.startTime, endTime);

    const windowHours = await this.getConfirmationWindowHours();
    const appointmentDateTime = combineDateAndTime(dto.date, dto.startTime);
    const confirmationDeadline = new Date(
      appointmentDateTime.getTime() - windowHours * 60 * 60 * 1000,
    );

    // Cupón (opcional): se valida ahora y se guarda el código para congelarlo en
    // el ticket al completar. Si el cliente envía uno inválido, se rechaza la
    // reserva con el motivo (evita reservar creyendo que hay descuento y que
    // luego no aplique). Se cotiza para asegurar que aplica a este cliente.
    let couponCode: string | null = null;
    const trimmedCoupon = dto.coupon?.trim();
    if (trimmedCoupon) {
      const couponQuote = await this.loyaltyService.quoteCoupon(
        clientId,
        trimmedCoupon,
        service.price,
      );
      if (couponQuote.error || !couponQuote.coupon) {
        throw new BadRequestException(couponQuote.error ?? 'Cupón no válido');
      }
      couponCode = couponQuote.coupon.code;
    }

    const created = await this.appointmentModel.create({
      client: new Types.ObjectId(clientId),
      barber: new Types.ObjectId(dto.barber),
      service: new Types.ObjectId(dto.service),
      date: dto.date,
      startTime: dto.startTime,
      endTime,
      status: AppointmentStatus.PENDIENTE,
      isRecurring: dto.isRecurring ?? false,
      recurringType: dto.recurringType ?? null,
      confirmationDeadline,
      notes: dto.notes ?? '',
      styleSelected: dto.styleSelected
        ? new Types.ObjectId(dto.styleSelected)
        : null,
      couponCode,
    });

    // Avisar al barbero de la nueva reserva (best-effort).
    await this.notifyBarber(barber, {
      title: 'Nueva reserva',
      body: `Tienes una nueva cita para ${service.name} el ${created.date.toLocaleDateString()} a las ${created.startTime}.`,
      type: NotificationType.CONFIRMACION_RESERVA,
      appointmentId: created.id,
    });

    return created;
  }

  /**
   * Registro de una atención directa (walk-in) hecho por el staff: un cliente
   * atendido sin reservar por la app. Crea una cita YA COMPLETADA, genera el
   * ticket y registra el pago, y cuenta en las estadísticas del barbero. La cita
   * ocupa el slot (assertNoOverlap), así que nadie más podrá agendar esa hora.
   *
   * - Cliente con cuenta (`client`): flujo completo (ticket + fidelización +
   *   trust-score + notificación), igual que al completar una cita normal.
   * - Invitado sin cuenta (`guestName`): se registra contra el usuario invitado
   *   genérico; solo genera ticket + pago (sin fidelización ni notificación).
   */
  async walkIn(
    dto: WalkInDto,
    registrarRole: Role,
  ): Promise<AppointmentDocument> {
    // Crea la cita completada + su ticket (reutilizable, sin cobrar todavía).
    const { appointment, ticketId } = await this.completeDirectAttention({
      barberId: dto.barber,
      serviceId: dto.service,
      date: dto.date,
      startTime: dto.startTime,
      clientId: dto.client,
      guestName: dto.guestName,
      notes: dto.notes,
    });

    if (!ticketId) {
      return appointment;
    }

    // El ADMIN/recepción cobra en el acto (efectivo por defecto, o el método
    // indicado). El BARBERO solo atiende: el ticket queda PENDIENTE y el admin
    // lo cobra después (mismo criterio que la fila virtual y las citas).
    if (registrarRole === Role.ADMIN) {
      const method = dto.paymentMethod ?? PaymentMethod.EFECTIVO;
      await this.paymentsService.create({ ticket: ticketId, method });
    } else {
      await this.notifyAdminsPendingCharge(appointment);
    }

    return appointment;
  }

  /**
   * Crea una atención directa YA completada (cita + ticket) sin cobrarla. Es la
   * base común del walk-in (que además cobra) y de la fila virtual (que deja el
   * ticket pendiente para que el admin lo cobre). Reserva el slot, y para un
   * cliente con cuenta suma fidelización/trust y notifica el ticket+puntos; para
   * un invitado sin cuenta solo genera el ticket. Devuelve la cita y el id del
   * ticket generado.
   */
  async completeDirectAttention(input: {
    barberId: string;
    serviceId: string;
    date: Date;
    startTime: string;
    clientId?: string;
    guestName?: string;
    notes?: string;
  }): Promise<{ appointment: AppointmentDocument; ticketId: string | null }> {
    const service = await this.servicesService.findById(input.serviceId);
    const barber = await this.barbersService.findById(input.barberId);

    // Determinar el cliente: el indicado (con cuenta) o el invitado genérico.
    let isGuest = false;
    let clientId: string;
    if (input.clientId) {
      clientId = input.clientId;
    } else {
      const guest = await this.usersService.getOrCreateGuestUser();
      clientId = guest.id;
      isGuest = true;
    }

    const endTime = addMinutesToTime(input.startTime, service.duration);

    // La atención debe caber en el horario del barbero y no solapar otra cita:
    // así el slot queda ocupado y nadie más podrá agendar esa hora.
    const dayEnum = JS_DAY_TO_ENUM[dayOfWeekUTC(input.date)];
    if (
      !this.fitsInSchedule(barber.schedule, dayEnum, input.startTime, endTime)
    ) {
      throw new BadRequestException(
        'La hora indicada está fuera del horario del barbero o cae en su descanso',
      );
    }
    await this.assertNoOverlap(
      input.barberId,
      input.date,
      input.startTime,
      endTime,
    );

    // La cita se crea YA completada (la atención ya ocurrió).
    const appointment = await this.appointmentModel.create({
      client: new Types.ObjectId(clientId),
      barber: new Types.ObjectId(input.barberId),
      service: new Types.ObjectId(input.serviceId),
      date: input.date,
      startTime: input.startTime,
      endTime,
      status: AppointmentStatus.COMPLETADA,
      confirmationDeadline: combineDateAndTime(input.date, input.startTime),
      confirmedByClient: true,
      notes:
        input.notes ?? (isGuest ? `Walk-in: ${input.guestName ?? ''}` : ''),
    });

    let ticketId: string | null = null;
    if (isGuest) {
      // Invitado: solo ticket (sin fidelización/trust/notificación).
      const ticket = await this.ticketsService.create({
        appointment: appointment.id,
        client: clientId,
        barber: input.barberId,
        service: input.serviceId,
        serviceDate: input.date,
        basePrice: service.price,
        discount: 0,
        price: service.price,
      });
      ticketId = ticket.id;
    } else {
      // Cliente con cuenta: flujo completo (ticket + fidelización + trust).
      await this.onCompleted(appointment);
      const ticket = await this.ticketsService.findByAppointment(
        appointment.id,
      );
      ticketId = ticket ? ticket.id : null;
    }

    this.logger.log(
      `Atención directa registrada: cita ${appointment.id} (${isGuest ? 'invitado' : 'cliente'}) - ${service.name}`,
    );
    return { appointment, ticketId };
  }

  async findAll(pagination: PaginationDto): Promise<{
    items: AppointmentDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      this.appointmentModel
        .find()
        .populate('service', 'name price duration')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ date: -1, startTime: -1 })
        .exec(),
      this.appointmentModel.countDocuments().exec(),
    ]);
    return { items, total, page, limit };
  }

  async findById(id: string): Promise<AppointmentDocument> {
    this.assertValidId(id);
    const appointment = await this.appointmentModel
      .findById(id)
      .populate('service', 'name price duration')
      .exec();
    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }
    return appointment;
  }

  /**
   * Historial de citas de un cliente (usado por GET /users/:id/history).
   */
  async findByClient(clientId: string): Promise<AppointmentDocument[]> {
    this.assertValidId(clientId, 'clientId');
    return this.appointmentModel
      .find({ client: new Types.ObjectId(clientId) })
      .populate('service', 'name price duration')
      .populate('barber')
      .sort({ date: -1 })
      .exec();
  }

  /**
   * Transición de estado ejecutada por el barbero. Dispara los efectos
   * secundarios según el nuevo estado.
   */
  async updateStatus(
    id: string,
    status: AppointmentStatus,
    cancelReason?: string,
  ): Promise<AppointmentDocument> {
    const appointment = await this.findById(id);

    if (
      appointment.status === AppointmentStatus.COMPLETADA ||
      appointment.status === AppointmentStatus.CANCELADA
    ) {
      throw new BadRequestException(
        'La cita ya está finalizada y no puede cambiar de estado',
      );
    }

    appointment.status = status;

    if (status === AppointmentStatus.CANCELADA) {
      appointment.cancelledBy = CancelledBy.BARBER;
      appointment.cancelReason = cancelReason ?? null;
      await appointment.save();
      // Avisar al cliente de la cancelación por parte del barbero.
      await this.notificationsService.createForUser({
        userId: extractId(appointment.client),
        title: 'Tu cita fue cancelada',
        body: cancelReason
          ? `El barbero canceló tu cita. Motivo: ${cancelReason}`
          : 'El barbero canceló tu cita.',
        type: NotificationType.CANCELACION_CITA,
        data: { appointmentId: appointment.id },
      });
      // El cupo queda libre: avisar a la lista de espera.
      await this.notifyWaitingList(appointment);
      return appointment;
    }

    if (status === AppointmentStatus.NO_ASISTIO) {
      await appointment.save();
      await this.trustScoreService.registerAction(
        extractId(appointment.client),
        TrustScoreAction.NO_ASISTIO,
        `No asistió a la cita ${appointment.id}`,
      );
      // Alertar al cliente del impacto en su trust score.
      await this.notificationsService.createForUser({
        userId: extractId(appointment.client),
        title: 'Registramos una inasistencia',
        body: 'No asististe a tu cita. Esto afecta tu trust score.',
        type: NotificationType.ALERTA_TRUST_SCORE,
        data: { appointmentId: appointment.id },
      });
      return appointment;
    }

    if (status === AppointmentStatus.COMPLETADA) {
      await appointment.save();
      await this.onCompleted(appointment);
      // El ticket queda PENDIENTE de cobro: avisar a los admins (cola de cobro).
      // El walk-in NO pasa por aquí (cobra en el acto), así que no genera este
      // aviso; solo las citas reservadas que el barbero marca completadas.
      await this.notifyAdminsPendingCharge(appointment);
      return appointment;
    }

    // CONFIRMADA u otros estados válidos del barbero: confirmar reserva.
    await appointment.save();
    if (status === AppointmentStatus.CONFIRMADA) {
      await this.notificationsService.createForUser({
        userId: extractId(appointment.client),
        title: 'Tu cita fue confirmada',
        body: `El barbero confirmó tu cita del ${appointment.date.toLocaleDateString()} a las ${appointment.startTime}.`,
        type: NotificationType.CONFIRMACION_RESERVA,
        data: { appointmentId: appointment.id },
      });
    }
    return appointment;
  }

  /**
   * Avisa a los administradores que una atención dejó un ticket PENDIENTE de
   * cobro (cola de cobro del admin). Incluye el ticketId para enrutar. Best-
   * effort: un fallo no debe romper la operación. Lo usan la cita reservada al
   * completarse y el walk-in registrado por un barbero (que no cobra); el
   * walk-in del admin cobra en el acto y no llama a esto.
   */
  private async notifyAdminsPendingCharge(
    appointment: AppointmentDocument,
  ): Promise<void> {
    try {
      const ticket = await this.ticketsService.findByAppointment(
        appointment.id,
      );
      await this.notificationsService.notifyAdmins({
        title: 'Cobro pendiente (cita)',
        body: 'Una cita se completó y queda pendiente de cobro.',
        type: NotificationType.AVISO_ADMIN,
        data: {
          appointmentId: appointment.id,
          ticketId: ticket ? ticket.id : null,
          clientId: extractId(appointment.client),
        },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo avisar a los admins del cobro de la cita ${appointment.id}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Efectos al completar una cita: genera ticket, ajusta trust-score.
   * (La suma de puntos de fidelidad se integrará con el módulo loyalty.)
   */
  private async onCompleted(appointment: AppointmentDocument): Promise<void> {
    // Los refs pueden venir poblados (findById puebla `service`); se extrae el
    // id de forma segura para evitar "[object Object]".
    const serviceId = extractId(appointment.service);
    const clientId = extractId(appointment.client);
    const barberId = extractId(appointment.barber);
    const service = await this.servicesService.findById(serviceId);

    // Precio final con la mejor promoción vigente + el cupón elegido al
    // reservar (si sigue siendo válido). Para "primera cita" se excluye esta
    // misma cita (ya completada) del conteo.
    const quote = await this.quote(
      serviceId,
      clientId,
      appointment.id,
      appointment.couponCode ?? undefined,
    );

    // 1) Generar el ticket con el desglose: precio original, descuento total,
    //    precio final, y la promoción y el cupón aplicados (congelados).
    const ticket = await this.ticketsService.create({
      appointment: appointment.id,
      client: clientId,
      barber: barberId,
      service: serviceId,
      serviceDate: appointment.date,
      basePrice: quote.basePrice,
      discount: quote.discount,
      price: quote.finalPrice,
      appliedPromotion: quote.promotion
        ? {
            promotion: quote.promotion.id,
            title: quote.promotion.title,
            type: quote.promotion.type,
            discountValue: quote.promotion.discountValue,
            scope: quote.promotion.scope,
          }
        : undefined,
      appliedCoupon: quote.coupon
        ? {
            coupon: quote.coupon.id,
            code: quote.coupon.code,
            discountType: quote.coupon.discountType,
            discountValue: quote.coupon.discountValue,
            discount: quote.coupon.discount,
          }
        : undefined,
      hairstyleSelected: appointment.styleSelected
        ? extractId(appointment.styleSelected)
        : undefined,
    });

    // 1b) Registrar la redención de la promoción (uso único por usuario).
    if (quote.promotion) {
      await this.promotionsService.registerRedemption(
        quote.promotion.id,
        clientId,
        ticket.id,
      );
    }

    // 1c) Consumir el cupón AHORA (al completar, no al reservar): marca al
    //     cliente como usuario del cupón para que no lo reutilice.
    if (quote.coupon) {
      await this.loyaltyService.markCouponUsed(quote.coupon.id, clientId);
    }

    // 1d) Consumir el SERVICIO GRATIS si se aplicó (decrementa el contador de
    //     fidelización de forma atómica). Best-effort: no debe romper el completar.
    if (quote.freeService) {
      try {
        await this.loyaltyService.redeemFreeService(clientId);
      } catch (error) {
        this.logger.warn(
          `No se pudo consumir el servicio gratis de ${clientId}: ${(error as Error).message}`,
        );
      }
    }

    // 2) Sumar +5 al trust score por cita completada con éxito.
    await this.trustScoreService.registerAction(
      clientId,
      TrustScoreAction.CITA_COMPLETADA,
      `Cita ${appointment.id} completada`,
    );

    // 3) Registrar la visita en fidelización (puntos + posible servicio gratis).
    const loyalty = await this.loyaltyService.registerCompletedVisit(clientId);

    // 4) Notificar al cliente con los datos del ticket.
    await this.notificationsService.createForUser({
      userId: clientId,
      title: 'Tu servicio se completó',
      body:
        quote.discount > 0
          ? `Ticket ${ticket.ticketNumber} por ${service.name}: ₡${quote.finalPrice} (antes ₡${quote.basePrice}, descuento ₡${quote.discount}).`
          : `Ticket ${ticket.ticketNumber} generado por ${service.name} (₡${quote.finalPrice}).`,
      type: NotificationType.TICKET_COMPLETADO,
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        appointmentId: appointment.id,
      },
    });

    // 5) Notificar los puntos de fidelización ganados. Barra de progreso que
    //    avanza de 20 en 20 y se completa en 100 (se reinicia a 0 al llegarlo).
    //    Es un indicador visual del avance por cita; el servicio gratis real se
    //    otorga por separado cada 10 visitas (ver módulo loyalty).
    const POINTS_PER_VISIT = 20;
    const REWARD_CYCLE = 100;
    const cyclePosition = loyalty.totalVisits % 5; // 1,2,3,4,0(=completo)
    const cycleProgress =
      cyclePosition === 0 ? REWARD_CYCLE : cyclePosition * POINTS_PER_VISIT; // 20,40,60,80,100
    const cycleCompleted = cyclePosition === 0 && loyalty.totalVisits > 0;
    const earnedFreeService = cycleCompleted && loyalty.totalVisits % 10 === 0;
    await this.notificationsService.createForUser({
      userId: clientId,
      title: earnedFreeService
        ? '¡Ganaste un servicio gratis! 🎉'
        : `Ganaste ${POINTS_PER_VISIT} puntos de fidelidad`,
      body: earnedFreeService
        ? 'Tienes un servicio gratis disponible por tus visitas.'
        : `Progreso: ${cycleProgress}/${REWARD_CYCLE} puntos. Nivel: ${loyalty.level}.`,
      type: NotificationType.PROMOCION,
      data: {
        pointsEarned: POINTS_PER_VISIT,
        totalPoints: loyalty.points,
        cycleProgress, // 20,40,60,80,100 — avance dentro del ciclo de 100
        rewardCycle: REWARD_CYCLE,
        level: loyalty.level,
        totalVisits: loyalty.totalVisits,
        freeServicesEarned: loyalty.freeServicesEarned,
        appointmentId: appointment.id,
      },
    });

    this.logger.log(
      `Cita ${appointment.id} completada, ticket ${ticket.ticketNumber} generado`,
    );
  }

  /**
   * Cancelación por parte del cliente. Penaliza el trust-score según la
   * antelación (< 2h = tardía, >= 2h = normal).
   */
  async cancelByClient(
    id: string,
    clientId: string,
    cancelReason?: string,
  ): Promise<AppointmentDocument> {
    const appointment = await this.findById(id);
    this.assertOwnership(appointment, clientId);

    if (
      appointment.status === AppointmentStatus.COMPLETADA ||
      appointment.status === AppointmentStatus.CANCELADA
    ) {
      throw new BadRequestException('La cita ya está finalizada');
    }

    const appointmentDateTime = combineDateAndTime(
      appointment.date,
      appointment.startTime,
    );
    const hoursUntil =
      (appointmentDateTime.getTime() - Date.now()) / (60 * 60 * 1000);

    appointment.status = AppointmentStatus.CANCELADA;
    appointment.cancelledBy = CancelledBy.CLIENT;
    appointment.cancelReason = cancelReason ?? null;
    await appointment.save();

    const windowHours = await this.getConfirmationWindowHours();
    const action =
      hoursUntil < windowHours
        ? TrustScoreAction.CANCELACION_TARDIA
        : TrustScoreAction.CANCELACION_NORMAL;
    await this.trustScoreService.registerAction(
      clientId,
      action,
      `Canceló la cita ${appointment.id}`,
    );

    // Cupo liberado: notificar al siguiente en lista de espera que coincida
    // con barbero/fecha/servicio. Best-effort: no debe romper la cancelación.
    await this.notifyWaitingList(appointment);

    // Avisar al barbero de que el cliente canceló (best-effort).
    await this.notifyBarberById(extractId(appointment.barber), {
      title: 'Un cliente canceló su cita',
      body: cancelReason
        ? `Se canceló la cita del ${appointment.date.toLocaleDateString()} a las ${appointment.startTime}. Motivo: ${cancelReason}`
        : `Se canceló la cita del ${appointment.date.toLocaleDateString()} a las ${appointment.startTime}.`,
      type: NotificationType.CANCELACION_CITA,
      appointmentId: appointment.id,
    });

    return appointment;
  }

  /**
   * Avisa al primer cliente en lista de espera que encaje con el cupo que
   * acaba de liberar una cita cancelada. Los errores se registran pero no se
   * propagan.
   */
  private async notifyWaitingList(
    appointment: AppointmentDocument,
  ): Promise<void> {
    try {
      await this.waitingListService.notifyNextMatch({
        barberId: extractId(appointment.barber),
        serviceId: extractId(appointment.service),
        date: appointment.date,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo notificar a la lista de espera: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Notifica al barbero a partir de su documento (con `user` poblado o no).
   * Resuelve el User del barbero (las notificaciones operan sobre usuarios, no
   * sobre perfiles de barbero) y delega en notifyBarberByUserId. Best-effort.
   */
  private async notifyBarber(
    barber: BarberDocument,
    payload: {
      title: string;
      body: string;
      type: NotificationType;
      appointmentId: string;
    },
  ): Promise<void> {
    await this.notifyBarberByUserId(extractId(barber.user), payload);
  }

  /**
   * Notifica al barbero a partir del id de su perfil (Barber._id). Carga el
   * barbero para resolver su User. Best-effort: un fallo no rompe la operación.
   */
  private async notifyBarberById(
    barberId: string,
    payload: {
      title: string;
      body: string;
      type: NotificationType;
      appointmentId: string;
    },
  ): Promise<void> {
    try {
      const barber = await this.barbersService.findById(barberId);
      await this.notifyBarberByUserId(extractId(barber.user), payload);
    } catch (error) {
      this.logger.warn(
        `No se pudo notificar al barbero ${barberId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Crea la notificación para el usuario (barbero) resuelto. Best-effort.
   */
  private async notifyBarberByUserId(
    barberUserId: string,
    payload: {
      title: string;
      body: string;
      type: NotificationType;
      appointmentId: string;
    },
  ): Promise<void> {
    try {
      await this.notificationsService.createForUser({
        userId: barberUserId,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        data: { appointmentId: payload.appointmentId },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo notificar al barbero (user ${barberUserId}): ${(error as Error).message}`,
      );
    }
  }

  /**
   * Doble check: el cliente confirma su asistencia.
   */
  async confirmByClient(
    id: string,
    clientId: string,
  ): Promise<AppointmentDocument> {
    const appointment = await this.findById(id);
    this.assertOwnership(appointment, clientId);
    appointment.confirmedByClient = true;
    if (appointment.status === AppointmentStatus.PENDIENTE) {
      appointment.status = AppointmentStatus.CONFIRMADA;
    }
    await appointment.save();
    return appointment;
  }

  async reschedule(
    id: string,
    clientId: string,
    dto: RescheduleAppointmentDto,
  ): Promise<AppointmentDocument> {
    const appointment = await this.findById(id);
    this.assertOwnership(appointment, clientId);

    if (
      appointment.status === AppointmentStatus.COMPLETADA ||
      appointment.status === AppointmentStatus.CANCELADA
    ) {
      throw new BadRequestException('La cita ya está finalizada');
    }

    // No se puede reprogramar a una fecha u hora que ya pasó.
    this.assertNotInPast(dto.date, dto.startTime);

    const service = await this.servicesService.findById(
      extractId(appointment.service),
    );
    const endTime = addMinutesToTime(dto.startTime, service.duration);

    // El nuevo horario debe caber en alguna franja disponible del barbero.
    const barberId = extractId(appointment.barber);
    const barber = await this.barbersService.findById(barberId);
    const dayEnum = JS_DAY_TO_ENUM[dayOfWeekUTC(dto.date)];
    if (
      !this.fitsInSchedule(barber.schedule, dayEnum, dto.startTime, endTime)
    ) {
      throw new BadRequestException(
        'La hora solicitada está fuera del horario del barbero o cae en su descanso',
      );
    }

    await this.assertNoOverlap(
      barberId,
      dto.date,
      dto.startTime,
      endTime,
      appointment.id,
    );

    const windowHours = await this.getConfirmationWindowHours();
    const appointmentDateTime = combineDateAndTime(dto.date, dto.startTime);
    appointment.date = dto.date;
    appointment.startTime = dto.startTime;
    appointment.endTime = endTime;
    appointment.confirmationDeadline = new Date(
      appointmentDateTime.getTime() - windowHours * 60 * 60 * 1000,
    );
    appointment.confirmedByClient = false;
    appointment.status = AppointmentStatus.PENDIENTE;
    await appointment.save();

    // Avisar al barbero de la nueva fecha/hora (best-effort).
    await this.notifyBarberById(extractId(appointment.barber), {
      title: 'Un cliente reprogramó su cita',
      body: `La cita se movió al ${appointment.date.toLocaleDateString()} a las ${appointment.startTime}.`,
      type: NotificationType.CONFIRMACION_RESERVA,
      appointmentId: appointment.id,
    });

    return appointment;
  }

  /**
   * Minutos de citas activas (pendiente/confirmada) que cada barbero aún tiene
   * comprometidos HOY, desde la hora actual hasta el fin de cada cita. Usado por
   * la fila virtual para que un walk-in espere a que el barbero termine sus
   * citas agendadas antes de atenderlo. Devuelve un mapa barberId -> minutos.
   */
  async getCommittedMinutesByBarber(): Promise<Map<string, number>> {
    const now = new Date();
    const { start, end } = dayRange(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const appts = await this.appointmentModel
      .find({
        date: { $gte: start, $lt: end },
        status: {
          $in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA],
        },
      })
      .exec();

    const committed = new Map<string, number>();
    for (const appt of appts) {
      const endMin = timeToMinutes(appt.endTime);
      // Minutos restantes de esta cita desde ahora (si ya terminó, 0).
      const remaining = Math.max(0, endMin - nowMinutes);
      if (remaining === 0) {
        continue;
      }
      const barberId = extractId(appt.barber);
      committed.set(barberId, (committed.get(barberId) ?? 0) + remaining);
    }
    return committed;
  }

  /**
   * Slots disponibles de un barbero en una fecha.
   *
   * - Recorre TODAS las franjas disponibles del barbero ese día (soporta
   *   varias franjas con descanso en medio, p. ej. 09:00-13:00 y 14:00-18:00).
   * - Si se pasa `serviceId`, cada slot reserva el bloque completo de la
   *   duración de ese servicio (p. ej. 120 min); así un servicio largo solo
   *   ofrece horas donde realmente cabe entero y no se pasa del fin de jornada.
   *   Si no se pasa, se usa el paso como longitud del bloque (retrocompatible).
   * - `stepMinutes` es la rejilla de inicios candidatos (por defecto 30 min):
   *   se ofrecen inicios cada 30 min aunque el servicio dure más.
   */
  async getAvailableSlots(
    barberId: string,
    date: Date,
    serviceId?: string,
    stepMinutes = 30,
  ): Promise<string[]> {
    const barber = await this.barbersService.findById(barberId);
    const dayEnum = JS_DAY_TO_ENUM[dayOfWeekUTC(date)];
    const daySlots = barber.schedule.filter(
      (s) => s.dayOfWeek === dayEnum && s.isAvailable,
    );
    if (daySlots.length === 0) {
      return [];
    }

    // Longitud del bloque a reservar: la duración del servicio si se indicó,
    // o el paso de la rejilla como respaldo.
    let blockMinutes = stepMinutes;
    if (serviceId) {
      const service = await this.servicesService.findById(serviceId);
      blockMinutes = service.duration;
    }

    const { start, end } = dayRange(date);
    const taken = await this.appointmentModel
      .find({
        barber: new Types.ObjectId(barberId),
        date: { $gte: start, $lt: end },
        // COMPLETADA cuenta como ocupado: una atención walk-in ya realizada ese
        // día bloquea el slot (el filtro por día evita afectar días pasados).
        status: {
          $in: [
            AppointmentStatus.PENDIENTE,
            AppointmentStatus.CONFIRMADA,
            AppointmentStatus.COMPLETADA,
          ],
        },
      })
      .exec();

    const takenRanges = taken.map((a) => ({
      start: timeToMinutes(a.startTime),
      end: timeToMinutes(a.endTime),
    }));

    // Si la fecha es HOY, no se ofrecen horas de inicio que ya pasaron (según la
    // hora del servidor). Para otros días no hay mínimo (-1 = sin restricción).
    const now = new Date();
    const minStartMinutes = isTodayServer(date)
      ? now.getHours() * 60 + now.getMinutes()
      : -1;

    // Genera inicios candidatos por cada franja; un inicio es válido si el
    // bloque completo cabe dentro de la franja, no solapa ninguna cita y (si es
    // hoy) su hora no ha pasado ya.
    const startsSet = new Set<number>();
    for (const slot of daySlots) {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);
      for (let m = slotStart; m + blockMinutes <= slotEnd; m += stepMinutes) {
        if (m < minStartMinutes) {
          continue; // hora ya pasada de hoy
        }
        const overlaps = takenRanges.some(
          (r) => m < r.end && m + blockMinutes > r.start,
        );
        if (!overlaps) {
          startsSet.add(m);
        }
      }
    }

    return Array.from(startsSet)
      .sort((a, b) => a - b)
      .map((m) => minutesToTime(m));
  }

  /**
   * Devuelve la disponibilidad del barbero para un día concreto, pensada para
   * dibujar un "reloj"/timeline: las franjas de trabajo y los bloques ocupados
   * (citas y descansos). NO reemplaza a `getAvailableSlots` (que sigue filtrando
   * las horas reservables según la duración del servicio); este método es solo
   * para pintar la forma del día con precisión.
   *
   * - `workingHours`: franjas disponibles del barbero ese día (vacío si libra).
   * - `busy`: bloques ocupados, ordenados: citas (`type: "cita"`, mismo criterio
   *   de estados que `getAvailableSlots`) y descansos (`type: "descanso"`, los
   *   huecos entre franjas de trabajo del mismo día).
   */
  async getDayAvailability(
    barberId: string,
    date: Date,
  ): Promise<{
    workingHours: Array<{ start: string; end: string }>;
    busy: Array<{ start: string; end: string; type: 'cita' | 'descanso' }>;
  }> {
    const barber = await this.barbersService.findById(barberId);
    const dayEnum = JS_DAY_TO_ENUM[dayOfWeekUTC(date)];

    // Franjas de trabajo del día, ordenadas por hora de inicio.
    const daySlots = barber.schedule
      .filter((s) => s.dayOfWeek === dayEnum && s.isAvailable)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    if (daySlots.length === 0) {
      return { workingHours: [], busy: [] };
    }

    const workingHours = daySlots.map((s) => ({
      start: s.startTime,
      end: s.endTime,
    }));

    // Descansos = huecos entre una franja y la siguiente (ej. 13:00→15:00).
    const busy: Array<{
      start: string;
      end: string;
      type: 'cita' | 'descanso';
    }> = [];
    for (let i = 0; i < daySlots.length - 1; i++) {
      const gapStart = timeToMinutes(daySlots[i].endTime);
      const gapEnd = timeToMinutes(daySlots[i + 1].startTime);
      if (gapEnd > gapStart) {
        busy.push({
          start: minutesToTime(gapStart),
          end: minutesToTime(gapEnd),
          type: 'descanso',
        });
      }
    }

    // Citas ocupadas: mismo criterio de estados que getAvailableSlots.
    const { start, end } = dayRange(date);
    const taken = await this.appointmentModel
      .find({
        barber: new Types.ObjectId(barberId),
        date: { $gte: start, $lt: end },
        status: {
          $in: [
            AppointmentStatus.PENDIENTE,
            AppointmentStatus.CONFIRMADA,
            AppointmentStatus.COMPLETADA,
          ],
        },
      })
      .exec();

    for (const appt of taken) {
      busy.push({
        start: appt.startTime,
        end: appt.endTime,
        type: 'cita',
      });
    }

    busy.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    return { workingHours, busy };
  }

  /**
   * Rechaza reservar en el pasado: si la fecha+hora de inicio es anterior al
   * momento actual del servidor, lanza BadRequestException. Se compara contra
   * `new Date()` (hora del servidor) — no depende del reloj del cliente. No se
   * aplica al walk-in, que registra atenciones ya ocurridas.
   */
  private assertNotInPast(date: Date, startTime: string): void {
    const when = combineDateAndTime(date, startTime);
    if (when.getTime() < Date.now()) {
      throw new BadRequestException(
        'No se puede reservar en una fecha u hora que ya pasó',
      );
    }
  }

  /**
   * Indica si el rango [startTime, endTime] (HH:mm) cabe COMPLETO dentro de
   * alguna franja disponible del barbero para el día indicado. Soporta varias
   * franjas por día; un rango que caiga en el hueco entre franjas (descanso) no
   * cabe en ninguna y se rechaza.
   */
  private fitsInSchedule(
    schedule: BarberDocument['schedule'],
    dayEnum: DayOfWeek,
    startTime: string,
    endTime: string,
  ): boolean {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    return schedule.some(
      (s) =>
        s.dayOfWeek === dayEnum &&
        s.isAvailable &&
        start >= timeToMinutes(s.startTime) &&
        end <= timeToMinutes(s.endTime),
    );
  }

  /**
   * Tiempo estimado de espera actual = suma de duraciones de las citas
   * activas de hoy aún no completadas.
   */
  async getCurrentWaitTime(): Promise<{ estimatedWaitMinutes: number }> {
    const { start, end } = dayRange(new Date());
    const active = await this.appointmentModel
      .find({
        date: { $gte: start, $lt: end },
        status: {
          $in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA],
        },
      })
      .exec();

    const minutes = active.reduce(
      (sum, a) => sum + (timeToMinutes(a.endTime) - timeToMinutes(a.startTime)),
      0,
    );
    return { estimatedWaitMinutes: minutes };
  }

  async getBarberStats(barberId: string): Promise<{
    total: number;
    completadas: number;
    canceladas: number;
    noAsistio: number;
  }> {
    this.assertValidId(barberId, 'barberId');
    const barberObjectId = new Types.ObjectId(barberId);
    const [total, completadas, canceladas, noAsistio] = await Promise.all([
      this.appointmentModel.countDocuments({ barber: barberObjectId }).exec(),
      this.appointmentModel
        .countDocuments({
          barber: barberObjectId,
          status: AppointmentStatus.COMPLETADA,
        })
        .exec(),
      this.appointmentModel
        .countDocuments({
          barber: barberObjectId,
          status: AppointmentStatus.CANCELADA,
        })
        .exec(),
      this.appointmentModel
        .countDocuments({
          barber: barberObjectId,
          status: AppointmentStatus.NO_ASISTIO,
        })
        .exec(),
    ]);
    return { total, completadas, canceladas, noAsistio };
  }

  async getBarberAppointments(
    barberId: string,
    period: 'day' | 'week' | 'month',
  ): Promise<AppointmentDocument[]> {
    this.assertValidId(barberId, 'barberId');
    // Ventana de CALENDARIO completa (incluye los días ya pasados de esta
    // semana/mes), no "desde hoy hacia adelante". Necesario para las métricas de
    // ingresos del barbero, que suman citas COMPLETADAS (casi siempre pasadas).
    // `day` sigue siendo todo el día de hoy (agenda). `price` se incluye en el
    // populate para que el front calcule ingresos sin llamar aparte a /services.
    const { start, end } = calendarRange(period);

    return this.appointmentModel
      .find({
        barber: new Types.ObjectId(barberId),
        date: { $gte: start, $lt: end },
      })
      .populate('service', 'name duration price')
      .populate('client', 'name avatar')
      .sort({ date: 1, startTime: 1 })
      .exec();
  }

  /**
   * Cancela automáticamente las citas cuyo confirmationDeadline ya pasó y que
   * el cliente no confirmó. Devuelve las citas afectadas (para notificar).
   */
  async autoCancelUnconfirmed(): Promise<AppointmentDocument[]> {
    const now = new Date();
    const filter: Record<string, unknown> = {
      status: AppointmentStatus.PENDIENTE,
      confirmedByClient: false,
      confirmationDeadline: { $lte: now },
    };

    const toCancel = await this.appointmentModel.find(filter).exec();
    if (toCancel.length === 0) {
      return [];
    }

    await this.appointmentModel
      .updateMany(filter, {
        status: AppointmentStatus.CANCELADA,
        cancelledBy: CancelledBy.SYSTEM,
        cancelReason: 'Cancelación automática: no confirmada a tiempo',
      })
      .exec();

    // Notificar a cada cliente afectado por la cancelación automática.
    await Promise.all(
      toCancel.map((appointment) =>
        this.notificationsService.createForUser({
          userId: extractId(appointment.client),
          title: 'Cita cancelada automáticamente',
          body: 'Tu cita se canceló porque no la confirmaste a tiempo.',
          type: NotificationType.CANCELACION_CITA,
          data: { appointmentId: appointment.id },
        }),
      ),
    );

    this.logger.warn(`Auto-canceladas ${toCancel.length} citas no confirmadas`);
    return toCancel;
  }

  /**
   * Envía recordatorios de cita al cliente: uno ~24h antes y otro ~1h antes.
   * Cada recordatorio se envía una sola vez (marca reminder24hSent/reminder1hSent
   * en la cita). Idempotente entre ejecuciones del cron. Devuelve cuántos
   * recordatorios se enviaron.
   */
  async sendDueReminders(): Promise<{ sent24h: number; sent1h: number }> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Citas activas del rango [ahora, +24h] con algún recordatorio pendiente.
    // El filtro por `date` acota a hoy/mañana; la hora exacta se afina abajo
    // combinando date + startTime.
    const candidates = await this.appointmentModel
      .find({
        status: {
          $in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA],
        },
        date: { $gte: this.startOfDay(now), $lte: in24h },
        // `$ne: true` cubre tanto false como undefined (citas creadas antes de
        // añadir estos campos).
        $or: [
          { reminder24hSent: { $ne: true } },
          { reminder1hSent: { $ne: true } },
        ],
      })
      .exec();

    let sent24h = 0;
    let sent1h = 0;

    for (const appt of candidates) {
      const apptTime = combineDateAndTime(appt.date, appt.startTime).getTime();
      const hoursUntil = (apptTime - now.getTime()) / (60 * 60 * 1000);
      if (hoursUntil <= 0) {
        continue; // ya pasó
      }
      const clientId = extractId(appt.client);

      // Recordatorio de 24h: cuando falten 24h o menos y aún no se envió.
      if (!appt.reminder24hSent && hoursUntil <= 24) {
        appt.reminder24hSent = true;
        // Si ya está dentro de la ventana de 1h al reservar tarde, evitamos el
        // de 24h para no mandar dos casi juntos: solo se envía si falta > 1h.
        if (hoursUntil > 1) {
          await this.sendReminder(clientId, appt, 'mañana');
          sent24h += 1;
        }
      }

      // Recordatorio de 1h: cuando falte 1h o menos y aún no se envió.
      if (!appt.reminder1hSent && hoursUntil <= 1) {
        appt.reminder1hSent = true;
        await this.sendReminder(clientId, appt, 'en 1 hora');
        sent1h += 1;
      }

      if (appt.isModified()) {
        await appt.save();
      }
    }

    if (sent24h + sent1h > 0) {
      this.logger.log(
        `Recordatorios enviados: ${sent24h} de 24h, ${sent1h} de 1h`,
      );
    }
    return { sent24h, sent1h };
  }

  /**
   * Envía un recordatorio de cita al cliente (best-effort).
   */
  private async sendReminder(
    clientId: string,
    appt: AppointmentDocument,
    when: string,
  ): Promise<void> {
    try {
      await this.notificationsService.createForUser({
        userId: clientId,
        title: 'Recordatorio de tu cita',
        body: `Tu cita es ${when} a las ${appt.startTime}. ¡Te esperamos!`,
        type: NotificationType.RECORDATORIO_CITA,
        data: { appointmentId: appt.id },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar recordatorio de la cita ${appt.id}: ${(error as Error).message}`,
      );
    }
  }

  /** Inicio del día (00:00) de una fecha. */
  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async assertNoOverlap(
    barberId: string,
    date: Date,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): Promise<void> {
    const { start, end } = dayRange(date);
    const filter: Record<string, unknown> = {
      barber: new Types.ObjectId(barberId),
      date: { $gte: start, $lt: end },
      // COMPLETADA cuenta como ocupado ese día (walk-in ya realizado): impide
      // agendar sobre una atención directa registrada por el staff.
      status: {
        $in: [
          AppointmentStatus.PENDIENTE,
          AppointmentStatus.CONFIRMADA,
          AppointmentStatus.COMPLETADA,
        ],
      },
    };
    if (excludeId) {
      filter._id = { $ne: new Types.ObjectId(excludeId) };
    }

    const sameDay = await this.appointmentModel.find(filter).exec();
    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);
    const overlap = sameDay.some((a) => {
      const s = timeToMinutes(a.startTime);
      const e = timeToMinutes(a.endTime);
      return newStart < e && newEnd > s;
    });
    if (overlap) {
      throw new BadRequestException(
        'El barbero ya tiene una cita en ese horario',
      );
    }
  }

  private assertOwnership(
    appointment: AppointmentDocument,
    clientId: string,
  ): void {
    if (extractId(appointment.client) !== clientId) {
      throw new ForbiddenException('Esta cita no te pertenece');
    }
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
