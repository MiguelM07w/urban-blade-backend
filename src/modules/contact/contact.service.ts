import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BarbershopConfigService } from '../barbershop-config/barbershop-config.service';
import { MailService } from '../mail/mail.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateContactDto } from './dto/create-contact.dto';
import {
  ContactMessage,
  ContactMessageDocument,
} from './schemas/contact-message.schema';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectModel(ContactMessage.name)
    private readonly contactModel: Model<ContactMessageDocument>,
    private readonly configService: BarbershopConfigService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Registra un mensaje del formulario público y notifica por correo a la
   * barbería (best-effort: un fallo de correo no rompe el registro).
   */
  async create(dto: CreateContactDto): Promise<{ success: true }> {
    await this.contactModel.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      message: dto.message,
    });

    await this.notifyBarbershop(dto);

    // Aviso in-app a los administradores (además del correo).
    await this.notificationsService.notifyAdmins({
      title: 'Nuevo mensaje de contacto',
      body: `${dto.name} escribió desde el formulario de contacto.`,
      type: NotificationType.AVISO_ADMIN,
      data: { name: dto.name, email: dto.email },
    });

    return { success: true };
  }

  /**
   * Envía el mensaje al correo de la barbería (config.email). Best-effort.
   */
  private async notifyBarbershop(dto: CreateContactDto): Promise<void> {
    try {
      const config = await this.configService.getOrCreate();
      const to = config.email?.trim();
      if (!to) {
        this.logger.warn(
          'No hay email de la barbería configurado; no se notifica el mensaje de contacto',
        );
        return;
      }
      const subject = `Nuevo mensaje de contacto — ${dto.name}`;
      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:auto">
          <h2>Nuevo mensaje desde la web</h2>
          <p><strong>Nombre:</strong> ${dto.name}</p>
          <p><strong>Email:</strong> ${dto.email}</p>
          ${dto.phone ? `<p><strong>Teléfono:</strong> ${dto.phone}</p>` : ''}
          <p><strong>Mensaje:</strong></p>
          <p style="white-space:pre-wrap">${dto.message}</p>
        </div>`;
      const text = `Nuevo mensaje de contacto\nNombre: ${dto.name}\nEmail: ${dto.email}${
        dto.phone ? `\nTeléfono: ${dto.phone}` : ''
      }\nMensaje:\n${dto.message}`;
      await this.mailService.send(to, subject, html, text);
    } catch (error) {
      this.logger.warn(
        `No se pudo notificar el mensaje de contacto: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Lista los mensajes recibidos, más recientes primero (bandeja admin).
   */
  async findAll(): Promise<ContactMessageDocument[]> {
    return this.contactModel.find().sort({ createdAt: -1 }).exec();
  }

  /**
   * Marca un mensaje como leído (admin).
   */
  async markAsRead(id: string): Promise<ContactMessageDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('El id proporcionado no es válido');
    }
    const updated = await this.contactModel
      .findByIdAndUpdate(id, { isRead: true }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    return updated;
  }
}
