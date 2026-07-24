import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { extractId } from '../../common/utils';
import { BarbersService } from '../barbers/barbers.service';
import { ChatService } from '../chat/chat.service';
import { MessageType } from '../chat/enums/message-type.enum';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { AnalyzeDto } from './dto/analyze.dto';
import { CreateHairstyleDto } from './dto/create-hairstyle.dto';
import { UpdateHairstyleDto } from './dto/update-hairstyle.dto';
import {
  AIRecommendationHistory,
  AIRecommendationHistoryDocument,
} from './schemas/ai-recommendation-history.schema';
import { Hairstyle, HairstyleDocument } from './schemas/hairstyle.schema';

@Injectable()
export class AIRecommendationService {
  private readonly logger = new Logger(AIRecommendationService.name);

  constructor(
    @InjectModel(Hairstyle.name)
    private readonly hairstyleModel: Model<HairstyleDocument>,
    @InjectModel(AIRecommendationHistory.name)
    private readonly historyModel: Model<AIRecommendationHistoryDocument>,
    private readonly barbersService: BarbersService,
    private readonly notificationsService: NotificationsService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * Recibe el resultado del análisis del móvil (faceType, hairType) y devuelve
   * los cortes compatibles de la base de datos. El backend NO procesa imágenes:
   * solo aplica la lógica de recomendación consultando MongoDB.
   */
  async analyze(
    userId: string,
    dto: AnalyzeDto,
  ): Promise<{
    recommendations: HairstyleDocument[];
    historyId: string;
  }> {
    this.assertValidId(userId, 'userId');

    // Un corte es compatible si su lista de faceTypes incluye el rostro
    // detectado y su lista de hairTypes incluye el tipo de cabello detectado.
    const recommendations = await this.hairstyleModel
      .find({
        isActive: true,
        faceTypes: dto.faceType,
        hairTypes: dto.hairType,
      })
      .sort({ isTrending: -1, name: 1 })
      .exec();

    // Se registra el análisis para historial/analítica.
    const history = await this.historyModel.create({
      user: new Types.ObjectId(userId),
      faceTypeDetected: dto.faceType,
      hairTypeDetected: dto.hairType,
      hairstylesRecommended: recommendations.map((h) => h._id),
      selfieUrl: dto.selfieUrl ?? null,
    });

    return { recommendations, historyId: history.id };
  }

  /**
   * Historial de recomendaciones de un usuario.
   */
  async getHistory(
    userId: string,
  ): Promise<AIRecommendationHistoryDocument[]> {
    this.assertValidId(userId, 'userId');
    return this.historyModel
      .find({ user: new Types.ObjectId(userId) })
      .populate('hairstylesRecommended', 'name category images')
      .populate('hairstyleSelected', 'name category')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * El cliente comparte con un barbero el estilo elegido. Hace tres cosas:
   *  1) registra la elección en el último análisis,
   *  2) crea (o reutiliza) la conversación de chat cliente-barbero y publica
   *     un mensaje con el estilo,
   *  3) notifica al barbero.
   *
   * Devuelve el ID de la conversación para que el móvil pueda abrir el chat.
   */
  async shareWithBarber(
    userId: string,
    barberId: string,
    hairstyleId: string,
  ): Promise<{ shared: boolean; conversationId: string }> {
    this.assertValidId(userId, 'userId');
    this.assertValidId(barberId, 'barber');
    this.assertValidId(hairstyleId, 'hairstyle');

    const hairstyle = await this.hairstyleModel
      .findOne({ _id: hairstyleId, isActive: true })
      .exec();
    if (!hairstyle) {
      throw new NotFoundException('Estilo no encontrado');
    }

    // Guarda la elección en el análisis más reciente del usuario, si existe.
    const lastHistory = await this.historyModel
      .findOne({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    if (lastHistory) {
      lastHistory.hairstyleSelected = new Types.ObjectId(hairstyleId);
      await lastHistory.save();
    }

    // El barbero se resuelve a su usuario (chat/notificaciones operan sobre
    // usuarios, no sobre perfiles de barbero).
    const barber = await this.barbersService.findById(barberId);
    // El user puede venir como ObjectId o poblado; extractId cubre ambos casos.
    const barberUserId = extractId(barber.user);

    // 1) Conversación cliente-barbero (se reutiliza si ya existe).
    const conversation = await this.chatService.createConversation({
      participants: [userId, barberUserId],
    });

    // 2) Publica el estilo como mensaje. Si el corte tiene imagen la enviamos
    //    como mensaje de imagen; si no, como texto.
    const previewImage = hairstyle.images[0];
    if (previewImage) {
      await this.chatService.sendMessage(userId, {
        conversation: conversation.id,
        type: MessageType.IMAGE,
        content: `Me gustaría este corte: ${hairstyle.name}`,
        imageUrl: previewImage,
      });
    } else {
      await this.chatService.sendMessage(userId, {
        conversation: conversation.id,
        type: MessageType.TEXT,
        content: `Me gustaría este corte: ${hairstyle.name}`,
      });
    }

    // 3) Notifica al barbero del nuevo estilo compartido.
    await this.notificationsService.createForUser({
      userId: barberUserId,
      title: 'Un cliente compartió un estilo contigo',
      body: `El cliente quiere el corte "${hairstyle.name}".`,
      type: NotificationType.NUEVO_ESTILO,
      data: {
        hairstyleId,
        fromUserId: userId,
        conversationId: conversation.id,
      },
    });

    return { shared: true, conversationId: conversation.id };
  }

  // ---- Catálogo de estilos ----

  async findAllHairstyles(): Promise<HairstyleDocument[]> {
    return this.hairstyleModel
      .find({ isActive: true })
      .sort({ isTrending: -1, name: 1 })
      .exec();
  }

  async createHairstyle(
    dto: CreateHairstyleDto,
  ): Promise<HairstyleDocument> {
    return this.hairstyleModel.create(dto);
  }

  async updateHairstyle(
    id: string,
    dto: UpdateHairstyleDto,
  ): Promise<HairstyleDocument> {
    this.assertValidId(id);
    const updated = await this.hairstyleModel
      .findOneAndUpdate({ _id: id, isActive: true }, dto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Estilo no encontrado');
    }
    return updated;
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
