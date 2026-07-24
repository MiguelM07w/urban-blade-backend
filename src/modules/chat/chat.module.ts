import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    // Necesarios para que WsJwtGuard verifique el token del handshake.
    JwtModule.register({}),
    ConfigModule,
    // Para notificar (persistida + push) al destinatario de cada mensaje.
    NotificationsModule,
    // Para resolver el rol del emisor/destinatario y decidir a quién notificar.
    UsersModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, WsJwtGuard],
  exports: [ChatService],
})
export class ChatModule {}
