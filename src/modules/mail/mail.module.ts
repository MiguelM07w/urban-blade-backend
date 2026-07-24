import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Módulo global: expone MailService para el envío de correos (recuperación de
 * contraseña, etc.). Global para no re-importarlo en cada módulo.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
