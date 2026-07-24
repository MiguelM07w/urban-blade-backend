import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { extractId } from '../../common/utils';
import { Role } from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { ServicesService } from '../services/services.service';
import { BarbersService } from '../barbers/barbers.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { JoinQueueDto } from './dto/join-queue.dto';
import { QueueStatus } from './enums/queue-status.enum';
import { QueueEntry, QueueEntryDocument } from './schemas/queue-entry.schema';

/** Minutos por defecto si no se puede leer la duración del servicio. */
const DEFAULT_SERVICE_MINUTES = 30;
/** Ventana de aviso "te toca pronto" (minutos). */
const SOON_THRESHOLD_MINUTES = 10;
/** Minutos tras ser "llamado" sin presentarse antes de expirar la entrada. */
const CALLED_EXPIRY_MINUTES = 10;

/**
 * Una entrada de la fila con su posición y espera estimada ya calculadas.
 */
export interface QueueEntryView {
  id: string;
  client: string | null; // null si es invitado sin cuenta
  guestName: string | null;
  guestPhone: string | null;
  barber: string | null;
  service: string;
  status: QueueStatus;
  position: number; // posición global en la fila (1 = siguiente)
  estimatedWaitMinutes: number; // minutos estimados hasta ser atendido
  createdAt: Date;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectModel(QueueEntry.name)
    private readonly queueModel: Model<QueueEntryDocument>,
    private readonly servicesService: ServicesService,
    private readonly barbersService: BarbersService,
    private readonly notificationsService: NotificationsService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  /**
   * Registra un cliente en la fila. Un cliente autenticado se une a sí mismo
   * (no envía `client`); el staff (admin/barbero) puede registrar a otro
   * pasando `client`. Un cliente no puede tener dos entradas activas a la vez.
   */
  async join(
    user: AuthenticatedUser,
    dto: JoinQueueDto,
  ): Promise<QueueEntryView> {
    const isStaff = user.role === Role.ADMIN || user.role === Role.BARBER;

    // Validar servicio (y que exista) y barbero si se indicó.
    await this.servicesService.findById(dto.service);
    if (dto.barber) {
      await this.barbersService.findById(dto.barber);
    }

    // Modo invitado (walk-in anónimo): solo staff, con guestName.
    if (dto.guestName) {
      if (!isStaff) {
        throw new ForbiddenException(
          'Solo el personal puede registrar invitados en la fila',
        );
      }
      const createdGuest = await this.queueModel.create({
        client: null,
        guestName: dto.guestName,
        guestPhone: dto.guestPhone ?? null,
        barber: dto.barber ? new Types.ObjectId(dto.barber) : null,
        service: new Types.ObjectId(dto.service),
        status: QueueStatus.ESPERANDO,
      });
      const stateG = await this.computeState();
      return (
        stateG.find((e) => e.id === createdGuest.id) ??
        this.toView(createdGuest, stateG.length + 1, 0)
      );
    }

    // Modo con cuenta: cliente a sí mismo, o staff a otro vía `client`.
    let clientId = user.userId;
    if (dto.client && dto.client !== user.userId) {
      if (!isStaff) {
        throw new ForbiddenException(
          'Solo el personal puede registrar a otra persona en la fila',
        );
      }
      clientId = dto.client;
    }

    // No permitir dos entradas activas del mismo cliente.
    const active = await this.queueModel
      .findOne({
        client: new Types.ObjectId(clientId),
        status: { $in: [QueueStatus.ESPERANDO, QueueStatus.LLAMADO] },
      })
      .exec();
    if (active) {
      throw new BadRequestException('Ya estás en la fila de espera');
    }

    const created = await this.queueModel.create({
      client: new Types.ObjectId(clientId),
      barber: dto.barber ? new Types.ObjectId(dto.barber) : null,
      service: new Types.ObjectId(dto.service),
      status: QueueStatus.ESPERANDO,
    });

    // Avisar al barbero elegido que un cliente con app entró a la fila.
    if (dto.barber) {
      await this.notifyBarberJoined(dto.barber, clientId);
    }

    const state = await this.computeState();
    const view = state.find((e) => e.id === created.id);
    return view ?? this.toView(created, state.length + 1, 0);
  }

  /**
   * Notifica al barbero (a su User) que un cliente con cuenta se unió a su fila.
   * Best-effort: un fallo no debe impedir la entrada a la fila.
   */
  private async notifyBarberJoined(
    barberId: string,
    clientId: string,
  ): Promise<void> {
    try {
      const barber = await this.barbersService.findById(barberId);
      const barberUserId = extractId(barber.user);
      await this.notificationsService.createForUser({
        userId: barberUserId,
        title: 'Nuevo cliente en tu fila',
        body: 'Un cliente se unió a tu fila virtual.',
        type: NotificationType.FILA_NUEVO_CLIENTE,
        data: { clientId, barberId },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo avisar al barbero ${barberId} de la fila: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Estado completo de la fila (para el panel del staff): todas las entradas
   * activas con su posición y espera estimada.
   */
  async getQueue(): Promise<QueueEntryView[]> {
    return this.computeState();
  }

  /**
   * Estado de la fila de un cliente concreto (su entrada activa, si la tiene).
   */
  async getMyEntry(clientId: string): Promise<QueueEntryView | null> {
    const state = await this.computeState();
    return state.find((e) => e.client === clientId) ?? null;
  }

  /**
   * El cliente sale de la fila (o el staff lo saca). Solo el dueño o el staff.
   */
  async leave(id: string, user: AuthenticatedUser): Promise<void> {
    const entry = await this.getActiveEntry(id);
    const isStaff = user.role === Role.ADMIN || user.role === Role.BARBER;
    // Un invitado (client null) solo lo saca el staff; una entrada con cuenta,
    // su dueño o el staff.
    const isOwner =
      entry.client !== null && entry.client.toString() === user.userId;
    if (!isStaff && !isOwner) {
      throw new ForbiddenException('Esta entrada no te pertenece');
    }
    entry.status = QueueStatus.CANCELADO;
    await entry.save();
  }

  /**
   * El barbero/admin llama al cliente (su turno). Pasa a estado "llamado" y se
   * le notifica.
   */
  async call(id: string): Promise<QueueEntryView> {
    const entry = await this.getActiveEntry(id);
    entry.status = QueueStatus.LLAMADO;
    entry.calledAt = new Date();
    await entry.save();

    // Solo se notifica a clientes con cuenta (los invitados no tienen push).
    if (entry.client) {
      await this.notify(
        entry.client.toString(),
        'Es tu turno',
        'El barbero te está esperando. ¡Pasa!',
        entry.id,
      );
    }

    const state = await this.computeState();
    return state.find((e) => e.id === entry.id) ?? this.toView(entry, 0, 0);
  }

  /**
   * Marca una entrada como atendida: sale de la fila, avanza el resto, y genera
   * una atención completada (cita + ticket PENDIENTE de pago) para que el admin
   * la cobre después. El barbero de la atención es el de la entrada; si la
   * entrada no lo fijaba ("cualquiera"), se usa el barbero que marca atendido, o
   * el `barberId` indicado (obligatorio si un admin sin perfil de barbero la
   * marca). No cobra: el ticket queda pendiente. Avisa a los admins con el
   * ticketId para la cola de cobro.
   */
  async markServed(
    id: string,
    user: AuthenticatedUser,
    barberId?: string,
  ): Promise<void> {
    const entry = await this.getActiveEntry(id);

    const resolvedBarberId = await this.resolveServingBarber(
      entry,
      user,
      barberId,
    );

    entry.status = QueueStatus.ATENDIDO;
    entry.servedAt = new Date();
    await entry.save();

    // Generar la atención completada + ticket pendiente (sin cobrar). La hora es
    // "ahora" para no chocar con otras citas del barbero (assertNoOverlap).
    const now = new Date();
    const { ticketId } = await this.appointmentsService.completeDirectAttention(
      {
        barberId: resolvedBarberId,
        serviceId: extractId(entry.service),
        date: now,
        startTime: this.toHHMM(now),
        clientId: entry.client ? extractId(entry.client) : undefined,
        guestName: entry.guestName ?? undefined,
      },
    );

    // Avisar a los administradores: hay un cobro pendiente en la cola.
    await this.notificationsService.notifyAdmins({
      title: 'Cobro pendiente (fila)',
      body: entry.client
        ? 'Se atendió a un cliente de la fila; queda pendiente de cobro.'
        : `Se atendió a ${entry.guestName ?? 'un invitado'}; queda pendiente de cobro.`,
      type: NotificationType.AVISO_ADMIN,
      data: {
        queueEntryId: entry.id,
        ticketId,
        barberId: resolvedBarberId,
        clientId: entry.client ? extractId(entry.client) : null,
        guestName: entry.guestName ?? null,
      },
    });
  }

  /**
   * Resuelve el barbero que atendió: el de la entrada; si no lo fijaba, el
   * `barberId` indicado, o el perfil de barbero del usuario que marca atendido.
   * Lanza si no hay ninguno (p. ej. un admin sin barbero y sin indicarlo).
   */
  private async resolveServingBarber(
    entry: QueueEntryDocument,
    user: AuthenticatedUser,
    barberId?: string,
  ): Promise<string> {
    if (entry.barber) {
      return extractId(entry.barber);
    }
    if (barberId) {
      return barberId;
    }
    if (user.role === Role.BARBER) {
      const barber = await this.barbersService.findByUserId(user.userId);
      return barber.id;
    }
    throw new BadRequestException(
      'Debes indicar el barbero que atendió (barberId) para registrar el cobro',
    );
  }

  /** Formatea una fecha como hora HH:mm local (para la cita generada). */
  private toHHMM(date: Date): string {
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /**
   * Envía el aviso "te toca en ~10 min" a las entradas cuya espera estimada ya
   * entró en la ventana y aún no fueron avisadas. Devuelve cuántos avisos se
   * enviaron. Usado por el cron.
   */
  async notifySoonEntries(): Promise<number> {
    const state = await this.computeState();
    let sent = 0;
    for (const view of state) {
      // Los invitados (sin cuenta) no reciben push; se omiten.
      if (
        view.client &&
        view.status === QueueStatus.ESPERANDO &&
        view.estimatedWaitMinutes <= SOON_THRESHOLD_MINUTES
      ) {
        // Solo avisar una vez: marca soonNotifiedAt si estaba null.
        const updated = await this.queueModel
          .findOneAndUpdate(
            { _id: new Types.ObjectId(view.id), soonNotifiedAt: null },
            { soonNotifiedAt: new Date() },
            { new: true },
          )
          .exec();
        if (updated) {
          await this.notify(
            view.client,
            'Tu turno se acerca',
            `Faltan ~${SOON_THRESHOLD_MINUTES} min para tu turno. Ve acercándote.`,
            view.id,
          );
          sent += 1;
        }
      }
    }
    return sent;
  }

  /**
   * Expira las entradas que fueron "llamadas" pero no se marcaron como atendidas
   * dentro de la ventana (el cliente no se presentó). Pasan a "expirado" y salen
   * de la fila. Devuelve cuántas se expiraron y notifica al cliente (si tiene
   * cuenta). Usado por el cron.
   */
  async expireStaleCalled(): Promise<number> {
    const cutoff = new Date(Date.now() - CALLED_EXPIRY_MINUTES * 60 * 1000);
    const stale = await this.queueModel
      .find({
        status: QueueStatus.LLAMADO,
        calledAt: { $ne: null, $lte: cutoff },
      })
      .exec();
    if (stale.length === 0) {
      return 0;
    }

    for (const entry of stale) {
      entry.status = QueueStatus.EXPIRADO;
      await entry.save();
      if (entry.client) {
        await this.notify(
          entry.client.toString(),
          'Perdiste tu turno',
          'No te presentaste a tiempo y tu lugar en la fila expiró. Vuelve a unirte si aún deseas atención.',
          entry.id,
        );
      }
    }

    this.logger.log(
      `Expiradas ${stale.length} entradas de fila no presentadas`,
    );
    return stale.length;
  }

  // ---- Motor de estimación ----

  /**
   * Calcula posición y espera estimada de cada entrada activa.
   *
   * Modelo: cada barbero tiene un "reloj" (minutos hasta quedar libre). Se
   * recorren las entradas en orden FIFO; cada una se asigna a su barbero
   * preferido, o —si eligió "cualquiera"— al barbero con menor reloj. La espera
   * estimada de una entrada es el reloj de su barbero ANTES de sumarle su propio
   * servicio; luego el reloj de ese barbero avanza por la duración del servicio.
   */
  private async computeState(): Promise<QueueEntryView[]> {
    const entries = await this.queueModel
      .find({ status: { $in: [QueueStatus.ESPERANDO, QueueStatus.LLAMADO] } })
      .sort({ createdAt: 1 })
      .exec();
    if (entries.length === 0) {
      return [];
    }

    // Duración (min) de cada servicio involucrado.
    const serviceIds = [...new Set(entries.map((e) => e.service.toString()))];
    const durations = new Map<string, number>();
    await Promise.all(
      serviceIds.map(async (sid) => {
        try {
          const svc = await this.servicesService.findById(sid);
          durations.set(sid, svc.duration);
        } catch {
          durations.set(sid, DEFAULT_SERVICE_MINUTES);
        }
      }),
    );

    // Minutos que cada barbero ya tiene comprometidos hoy en citas agendadas:
    // el reloj de cada barbero arranca ahí (un walk-in espera a que termine sus
    // citas). Best-effort: si falla, se asume 0.
    let committed: Map<string, number>;
    try {
      committed = await this.appointmentsService.getCommittedMinutesByBarber();
    } catch {
      committed = new Map<string, number>();
    }

    // Reloj acumulado por barbero (min). Los barberos "reales" que aparecen en
    // la fila + un reloj compartido para las entradas "cualquiera" se resuelven
    // eligiendo el menor reloj entre los barberos conocidos.
    const barberClocks = new Map<string, number>();
    const knownBarbers = new Set<string>();
    for (const e of entries) {
      if (e.barber) {
        knownBarbers.add(e.barber.toString());
      }
    }
    // Si no hay ningún barbero preferido en la fila, usamos un barbero virtual
    // único que arranca con el MENOR compromiso (el primero que se desocupa).
    if (knownBarbers.size === 0) {
      const minCommitted =
        committed.size > 0 ? Math.min(...committed.values()) : 0;
      barberClocks.set('__any__', minCommitted);
    } else {
      for (const b of knownBarbers) {
        barberClocks.set(b, committed.get(b) ?? 0);
      }
    }

    const views: QueueEntryView[] = [];
    let position = 0;
    for (const e of entries) {
      const dur =
        durations.get(e.service.toString()) ?? DEFAULT_SERVICE_MINUTES;
      // Barbero asignado: el preferido, o el de menor reloj entre los conocidos.
      const assigned = e.barber
        ? e.barber.toString()
        : this.barberWithMinClock(barberClocks);
      const clock = barberClocks.get(assigned) ?? 0;

      position += 1;
      // "llamado" = espera 0 (ya es su turno).
      const wait = e.status === QueueStatus.LLAMADO ? 0 : Math.round(clock);
      views.push(this.toView(e, position, wait));

      // Avanza el reloj de ese barbero por la duración del servicio.
      barberClocks.set(assigned, clock + dur);
    }

    return views;
  }

  private barberWithMinClock(clocks: Map<string, number>): string {
    let min = Infinity;
    let chosen = '__any__';
    for (const [barber, clock] of clocks) {
      if (clock < min) {
        min = clock;
        chosen = barber;
      }
    }
    return chosen;
  }

  private toView(
    entry: QueueEntryDocument,
    position: number,
    estimatedWaitMinutes: number,
  ): QueueEntryView {
    return {
      id: entry.id,
      client: entry.client ? extractId(entry.client) : null,
      guestName: entry.guestName ?? null,
      guestPhone: entry.guestPhone ?? null,
      barber: entry.barber ? extractId(entry.barber) : null,
      service: extractId(entry.service),
      status: entry.status,
      position,
      estimatedWaitMinutes,
      createdAt: (entry as unknown as { createdAt: Date }).createdAt,
    };
  }

  private async getActiveEntry(id: string): Promise<QueueEntryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('El id proporcionado no es válido');
    }
    const entry = await this.queueModel.findById(id).exec();
    if (!entry) {
      throw new NotFoundException('Entrada de fila no encontrada');
    }
    if (
      entry.status === QueueStatus.ATENDIDO ||
      entry.status === QueueStatus.CANCELADO ||
      entry.status === QueueStatus.EXPIRADO
    ) {
      throw new BadRequestException('Esta entrada de fila ya no está activa');
    }
    return entry;
  }

  private async notify(
    userId: string,
    title: string,
    body: string,
    queueEntryId: string,
  ): Promise<void> {
    try {
      await this.notificationsService.createForUser({
        userId,
        title,
        body,
        type: NotificationType.RECORDATORIO_CITA,
        data: { queueEntryId },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo notificar la fila a ${userId}: ${(error as Error).message}`,
      );
    }
  }
}
