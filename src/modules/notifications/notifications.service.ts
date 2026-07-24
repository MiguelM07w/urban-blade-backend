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
import { Role } from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationType } from './enums/notification-type.enum';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

/**
 * Datos mínimos para crear una notificación de forma programática desde otros
 * módulos (appointments, loyalty, reviews, etc.).
 */
export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * Punto de entrada reutilizable: persiste la notificación en la base de datos
   * y dispara el envío push. Los demás módulos deben usar este método.
   */
  async createForUser(
    input: CreateNotificationInput,
  ): Promise<NotificationDocument> {
    this.assertValidId(input.userId, 'userId');

    const notification = await this.notificationModel.create({
      user: new Types.ObjectId(input.userId),
      title: input.title,
      body: input.body,
      type: input.type,
      data: input.data ?? {},
      sentAt: new Date(),
    });

    // Envío push (best-effort): un fallo de FCM no debe tumbar la operación
    // de negocio que originó la notificación.
    await this.pushToDevice(input.userId, input.title, input.body, input.data);

    return notification;
  }

  /**
   * Envío manual a un usuario concreto (endpoint admin).
   */
  async send(dto: SendNotificationDto): Promise<NotificationDocument> {
    return this.createForUser({
      userId: dto.user,
      title: dto.title,
      body: dto.body,
      type: dto.type,
      data: dto.data,
    });
  }

  /**
   * Difusión a todos los usuarios activos (endpoint admin).
   * Inserta en lote y devuelve cuántas notificaciones se crearon.
   */
  async broadcast(dto: BroadcastNotificationDto): Promise<{ sent: number }> {
    // Difusión dirigida solo a CLIENTES: el staff (admin/barberos) no recibe
    // promociones ni avisos masivos pensados para la clientela.
    const users = await this.usersService.findActiveIdsByRole(Role.CLIENT);
    if (users.length === 0) {
      return { sent: 0 };
    }

    const now = new Date();
    const docs = users.map((userId) => ({
      user: new Types.ObjectId(userId),
      title: dto.title,
      body: dto.body,
      type: dto.type,
      data: dto.data ?? {},
      sentAt: now,
    }));

    await this.notificationModel.insertMany(docs);
    this.logger.log(`Broadcast enviado a ${docs.length} usuarios`);

    // El push masivo real se delega a FCM (multicast) en la integración futura.
    return { sent: docs.length };
  }

  /**
   * Notifica a TODOS los administradores activos (avisos internos: mensaje de
   * contacto, corte completado en la fila, etc.). Best-effort: los errores por
   * cada admin se registran pero no rompen la operación que originó el aviso.
   */
  async notifyAdmins(
    input: Omit<CreateNotificationInput, 'userId'>,
  ): Promise<void> {
    const adminIds = await this.usersService.findActiveIdsByRole(Role.ADMIN);
    await Promise.all(
      adminIds.map((userId) =>
        this.createForUser({ ...input, userId }).catch((error) => {
          this.logger.warn(
            `No se pudo notificar al admin ${userId}: ${(error as Error).message}`,
          );
        }),
      ),
    );
  }

  async findByUser(
    userId: string,
    requester: AuthenticatedUser,
  ): Promise<NotificationDocument[]> {
    this.assertValidId(userId, 'userId');
    this.assertOwnership(userId, requester);
    return this.notificationModel
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markAsRead(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<NotificationDocument> {
    this.assertValidId(id);
    const notification = await this.notificationModel.findById(id).exec();
    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }
    this.assertOwnership(notification.user.toString(), requester);
    notification.isRead = true;
    await notification.save();
    return notification;
  }

  async remove(id: string, requester: AuthenticatedUser): Promise<void> {
    this.assertValidId(id);
    const notification = await this.notificationModel.findById(id).exec();
    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }
    this.assertOwnership(notification.user.toString(), requester);
    await notification.deleteOne();
  }

  /**
   * Verifica que el solicitante sea el dueño de la notificación (o admin). El
   * admin puede acceder a cualquiera; el resto solo a las suyas. Lanza
   * ForbiddenException si no tiene permiso.
   */
  private assertOwnership(ownerId: string, requester: AuthenticatedUser): void {
    if (requester.role !== Role.ADMIN && ownerId !== requester.userId) {
      throw new ForbiddenException('No puedes acceder a notificaciones ajenas');
    }
  }

  /**
   * Envío push vía FCM. Resuelve el token del usuario y delega en
   * FirebaseService. Si Firebase no está configurado, el envío se registra en
   * log (FirebaseService lo maneja internamente).
   */
  private async pushToDevice(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user.fcmToken) {
        return; // El usuario no tiene dispositivo registrado.
      }
      // FCM sólo admite valores string en `data`; serializamos lo necesario.
      const stringData = this.stringifyData(data);
      await this.firebaseService.sendPush(
        user.fcmToken,
        title,
        body,
        stringData,
      );
    } catch (error) {
      // No propagamos: la notificación ya quedó persistida.
      this.logger.warn(
        `No se pudo enviar el push a ${userId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * FCM exige que el payload `data` tenga sólo valores string. Convierte cada
   * valor a string (los objetos se serializan a JSON).
   */
  private stringifyData(
    data?: Record<string, unknown>,
  ): Record<string, string> | undefined {
    if (!data) {
      return undefined;
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return result;
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
