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
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { ChatGateway } from './chat.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageType } from './enums/message-type.enum';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Crea una conversación. Si ya existe una con exactamente los mismos
   * participantes, la reutiliza (evita duplicados).
   */
  async createConversation(
    dto: CreateConversationDto,
  ): Promise<ConversationDocument> {
    const participantIds = dto.participants.map((id) => new Types.ObjectId(id));

    const existing = await this.conversationModel
      .findOne({
        participants: { $all: participantIds, $size: participantIds.length },
      })
      .exec();
    if (existing) {
      return existing;
    }

    return this.conversationModel.create({
      participants: participantIds,
      appointment: dto.appointment ? new Types.ObjectId(dto.appointment) : null,
    });
  }

  /**
   * Lista las conversaciones de un usuario, ordenadas por actividad reciente.
   */
  async findConversationsByUser(
    userId: string,
  ): Promise<ConversationDocument[]> {
    this.assertValidId(userId, 'userId');
    return this.conversationModel
      .find({ participants: userId })
      .populate('participants', 'name avatar')
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .exec();
  }

  /**
   * Devuelve los mensajes de una conversación en orden cronológico.
   */
  async findMessages(conversationId: string): Promise<MessageDocument[]> {
    this.assertValidId(conversationId, 'conversationId');
    // El id se castea explícitamente a ObjectId: el casteo implícito de
    // Mongoose sobre este campo escalar no es fiable en todas las versiones.
    return this.messageModel
      .find({ conversation: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  /**
   * Persiste un mensaje y actualiza el resumen de la conversación. Valida que
   * el emisor sea participante. Devuelve el mensaje creado (usado también por
   * el gateway para emitirlo en tiempo real).
   */
  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<MessageDocument> {
    this.assertValidId(senderId, 'senderId');
    const conversation = await this.conversationModel
      .findById(dto.conversation)
      .exec();
    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === senderId,
    );
    if (!isParticipant) {
      throw new ForbiddenException('No participas en esta conversación');
    }

    const type = dto.type ?? MessageType.TEXT;
    const message = await this.messageModel.create({
      conversation: conversation._id,
      sender: new Types.ObjectId(senderId),
      content: dto.content ?? '',
      type,
      imageUrl: type === MessageType.IMAGE ? (dto.imageUrl ?? null) : null,
    });

    // Actualiza el resumen para el listado de conversaciones.
    conversation.lastMessage =
      type === MessageType.IMAGE ? '📷 Imagen' : (dto.content ?? '');
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Notifica (persistida + push) a los destinatarios: todos los participantes
    // que no sean el emisor. Best-effort: un fallo no debe romper el envío.
    await this.notifyRecipients(conversation, senderId, type, dto.content);

    return message;
  }

  /**
   * Crea una notificación de "nuevo mensaje" para cada participante distinto del
   * emisor, EXCEPTO los que están activos en la conversación (viéndola en vivo
   * por WebSocket): a esos les basta el evento `newMessage` en tiempo real, así
   * que se omite la notificación para no duplicar el aviso. Los destinatarios
   * que no están viendo el chat (app cerrada o en otra pantalla) sí la reciben,
   * para que la comunicación entre roles avise igual. Best-effort: los errores
   * se registran pero no se propagan.
   */
  private async notifyRecipients(
    conversation: ConversationDocument,
    senderId: string,
    type: MessageType,
    content?: string,
  ): Promise<void> {
    const preview =
      type === MessageType.IMAGE ? '📷 Imagen' : (content ?? '').trim();
    const body =
      preview.length > 0
        ? preview.length > 120
          ? `${preview.slice(0, 117)}...`
          : preview
        : 'Tienes un mensaje nuevo';

    const conversationId = extractId(conversation._id);
    const recipientIds = conversation.participants
      .map((p) => extractId(p))
      .filter((id) => id !== senderId);

    // Rol del emisor: se usa para restringir a quién notificar (ver regla abajo).
    const senderRole = await this.resolveRole(senderId);

    await Promise.all(
      recipientIds.map(async (recipientId) => {
        try {
          // Regla: al ADMIN solo lo notifican los BARBEROS (no los clientes). Si
          // el destinatario es admin y el emisor no es barbero, se omite el aviso
          // (el mensaje sigue guardado y llega en vivo por WebSocket si abre el chat).
          const recipientRole = await this.resolveRole(recipientId);
          if (recipientRole === Role.ADMIN && senderRole !== Role.BARBER) {
            return;
          }

          // Si el destinatario está viendo esta conversación en vivo, ya recibe
          // el mensaje por `newMessage`; no lo notificamos para no duplicar.
          const isActive = await this.chatGateway.isUserActiveInConversation(
            recipientId,
            conversationId,
          );
          if (isActive) {
            return;
          }
          await this.notificationsService.createForUser({
            userId: recipientId,
            title: 'Nuevo mensaje',
            body,
            type: NotificationType.NUEVO_MENSAJE,
            data: {
              conversationId,
              senderId,
            },
          });
        } catch (error) {
          this.logger.warn(
            `No se pudo notificar el mensaje a ${recipientId}: ${
              (error as Error).message
            }`,
          );
        }
      }),
    );
  }

  /**
   * Resuelve el rol de un usuario por su id. Best-effort: si no se puede leer
   * (usuario borrado, etc.) devuelve null; la lógica de notificación lo trata
   * como "no admin / no barbero" para no bloquear ni filtrar de más.
   */
  private async resolveRole(userId: string): Promise<Role | null> {
    try {
      const user = await this.usersService.findById(userId);
      return user.role;
    } catch {
      return null;
    }
  }

  /**
   * Marca un mensaje como leído.
   */
  async markAsRead(messageId: string): Promise<MessageDocument> {
    this.assertValidId(messageId, 'messageId');
    const message = await this.messageModel
      .findByIdAndUpdate(messageId, { isRead: true }, { new: true })
      .exec();
    if (!message) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    return message;
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
