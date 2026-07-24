import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { JoinWaitingListDto } from './dto/join-waiting-list.dto';
import { WaitingListStatus } from './enums/waiting-list-status.enum';
import {
  WaitingList,
  WaitingListDocument,
} from './schemas/waiting-list.schema';
import { dayRange } from '../appointments/utils/time.util';

/** Ventana de reserva tras ser notificado (24h según spec). */
const NOTIFICATION_WINDOW_HOURS = 24;

/**
 * Criterios que describen el cupo liberado, para buscar coincidencias.
 */
export interface SlotMatch {
  barberId: string;
  serviceId: string;
  date: Date;
}

@Injectable()
export class WaitingListService {
  private readonly logger = new Logger(WaitingListService.name);

  constructor(
    @InjectModel(WaitingList.name)
    private readonly waitingListModel: Model<WaitingListDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Un cliente se une a la lista de espera.
   */
  async join(
    clientId: string,
    dto: JoinWaitingListDto,
  ): Promise<WaitingListDocument> {
    return this.waitingListModel.create({
      client: new Types.ObjectId(clientId),
      barber: dto.barber ? new Types.ObjectId(dto.barber) : null,
      service: new Types.ObjectId(dto.service),
      preferredDate: dto.preferredDate,
      preferredTimeRange: dto.preferredTimeRange ?? { start: '', end: '' },
      status: WaitingListStatus.ESPERANDO,
    });
  }

  async findAll(): Promise<WaitingListDocument[]> {
    return this.waitingListModel
      .find()
      .populate('service', 'name')
      .sort({ createdAt: 1 })
      .exec();
  }

  async findByClient(clientId: string): Promise<WaitingListDocument[]> {
    this.assertValidId(clientId, 'clientId');
    return this.waitingListModel
      .find({ client: new Types.ObjectId(clientId) })
      .populate('service', 'name')
      .sort({ createdAt: 1 })
      .exec();
  }

  /**
   * Un cliente sale de la lista de espera. Solo el dueño de la entrada puede
   * eliminarla.
   */
  async leave(id: string, clientId: string): Promise<void> {
    this.assertValidId(id);
    const entry = await this.waitingListModel.findById(id).exec();
    if (!entry) {
      throw new NotFoundException('Entrada de lista de espera no encontrada');
    }
    if (entry.client.toString() !== clientId) {
      throw new ForbiddenException('Esta entrada no te pertenece');
    }
    await this.waitingListModel.findByIdAndDelete(id).exec();
  }

  /**
   * Al liberarse un cupo (p. ej. una cita cancelada), notifica al primer
   * cliente en espera que coincida con barbero/fecha/servicio. El barbero es
   * opcional en la entrada (null = cualquiera). Devuelve la entrada notificada
   * o null si no había coincidencias.
   *
   * Llamado por appointments al cancelar una cita.
   */
  async notifyNextMatch(
    match: SlotMatch,
  ): Promise<WaitingListDocument | null> {
    const { start, end } = dayRange(match.date);

    // Coincide el servicio, la fecha (mismo día) y el barbero preferido o bien
    // cualquiera (barber = null). Se toma el más antiguo (prioridad FIFO).
    const candidate = await this.waitingListModel
      .findOne({
        status: WaitingListStatus.ESPERANDO,
        service: new Types.ObjectId(match.serviceId),
        preferredDate: { $gte: start, $lt: end },
        $or: [
          { barber: new Types.ObjectId(match.barberId) },
          { barber: null },
        ],
      })
      .sort({ createdAt: 1 })
      .exec();

    if (!candidate) {
      return null;
    }

    const now = new Date();
    candidate.status = WaitingListStatus.NOTIFICADO;
    candidate.notifiedAt = now;
    candidate.expiresAt = new Date(
      now.getTime() + NOTIFICATION_WINDOW_HOURS * 60 * 60 * 1000,
    );
    await candidate.save();

    await this.notificationsService.createForUser({
      userId: candidate.client.toString(),
      title: 'Se liberó un cupo',
      body: 'Hay un espacio disponible que coincide con tu preferencia. Tienes 24h para reservar.',
      type: NotificationType.LISTA_DE_ESPERA,
      data: {
        waitingListId: candidate.id,
        serviceId: match.serviceId,
        barberId: match.barberId,
      },
    });

    this.logger.log(
      `Notificado cliente ${candidate.client.toString()} por cupo liberado`,
    );
    return candidate;
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
