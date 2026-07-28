import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

/**
 * Encapsula el SDK de firebase-admin para el envío de notificaciones push
 * (FCM). Si no hay credenciales configuradas, el servicio queda deshabilitado
 * y los envíos se registran en log en vez de enviarse, para no romper el
 * entorno de desarrollo.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.configService.get<string>('firebase.projectId');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKey = this.configService.get<string>('firebase.privateKey');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase no configurado: las notificaciones push se registrarán en log',
      );
      return;
    }

    // Inicialización tolerante a fallos: si las credenciales son inválidas (p. ej.
    // una private key mal formateada en las variables de entorno), se registra el
    // error y el servicio queda deshabilitado, pero la app NO se cae. Los push se
    // registran en log hasta corregir la credencial.
    try {
      // Reutiliza la app por defecto si ya existe (p. ej. en tests).
      const existing = getApps();
      this.app = existing.length
        ? existing[0]
        : initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
          });
      this.logger.log('Firebase Admin inicializado');
    } catch (error) {
      this.app = null;
      this.logger.error(
        `Firebase no se pudo inicializar (credencial inválida); los push se ` +
          `registrarán en log. Detalle: ${(error as Error).message}`,
      );
    }
  }

  isEnabled(): boolean {
    return this.app !== null;
  }

  /**
   * Envía una notificación push a un dispositivo. Devuelve true si se envió,
   * false si Firebase está deshabilitado o el envío falló (sin propagar el
   * error, para que la operación de negocio que la originó no se rompa).
   */
  async sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.app) {
      this.logger.debug(`[FCM deshabilitado] push simulado: ${title}`);
      return false;
    }
    try {
      await getMessaging(this.app).send({
        token,
        notification: { title, body },
        data,
      });
      return true;
    } catch (error) {
      this.logger.warn(`Error enviando push FCM: ${(error as Error).message}`);
      return false;
    }
  }
}
