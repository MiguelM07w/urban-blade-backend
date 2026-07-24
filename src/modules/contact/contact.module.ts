import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BarbershopConfigModule } from '../barbershop-config/barbershop-config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import {
  ContactMessage,
  ContactMessageSchema,
} from './schemas/contact-message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactMessage.name, schema: ContactMessageSchema },
    ]),
    // Para leer el email de la barbería al notificar. MailService es global.
    BarbershopConfigModule,
    // Para avisar in-app a los admins de un nuevo mensaje de contacto.
    NotificationsModule,
  ],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
