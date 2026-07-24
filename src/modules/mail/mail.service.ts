import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Envío de correos vía SMTP (Nodemailer). Si no hay credenciales SMTP
 * configuradas, el servicio queda deshabilitado y los envíos se registran en
 * log en vez de enviarse, para no romper el entorno de desarrollo (mismo
 * patrón que FirebaseService).
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('mail.host');
    const user = this.configService.get<string>('mail.user');
    const pass = this.configService.get<string>('mail.pass');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP no configurado: los correos se registrarán en log en vez de enviarse',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('mail.port', 587),
      secure: this.configService.get<boolean>('mail.secure', false),
      auth: { user, pass },
    });
    this.logger.log('Servicio de correo (SMTP) inicializado');
  }

  isEnabled(): boolean {
    return this.transporter !== null;
  }

  /**
   * Envía un correo. Devuelve true si se envió, false si SMTP está deshabilitado
   * o el envío falló (sin propagar el error, para no tumbar la operación que lo
   * originó).
   */
  async send(
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<boolean> {
    if (!this.transporter) {
      this.logger.debug(
        `[SMTP deshabilitado] correo simulado a ${to}: ${subject}`,
      );
      return false;
    }
    try {
      const from =
        this.configService.get<string>('mail.from') ||
        this.configService.get<string>('mail.user');
      await this.transporter.sendMail({ from, to, subject, html, text });
      return true;
    } catch (error) {
      this.logger.warn(
        `Error enviando correo a ${to}: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
