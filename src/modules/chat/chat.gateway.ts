import { forwardRef, Inject, Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatService } from './chat.service';

/**
 * Datos que adjuntamos al socket tras autenticar el handshake. Socket.io tipa
 * `socket.data` como `any`; este tipo lo acota para acceder al usuario de forma
 * segura.
 */
interface ChatSocketData {
  user?: AuthenticatedUser;
}

/**
 * Gateway de chat en tiempo real (Socket.io).
 *
 * Autenticación: el handshake debe traer un access token JWT válido en
 * `auth.token` o en el header Authorization. Se valida al conectar y el usuario
 * autenticado queda en `socket.data.user`; los conexiones sin token válido se
 * rechazan.
 *
 * Eventos entrantes:
 *  - joinConversation { conversationId }  → une el socket a la sala.
 *  - leaveConversation { conversationId } → lo saca de la sala.
 *  - sendMessage { ...SendMessageDto }    → persiste y difunde. El emisor se
 *    toma del token, NO del payload.
 *
 * Eventos salientes:
 *  - newMessage → emitido a la sala de la conversación con el mensaje creado.
 */
@WebSocketGateway({
  cors: { origin: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly wsJwtGuard: WsJwtGuard,
  ) {}

  /**
   * Autentica el handshake. Si el token es inválido/ausente, se desconecta el
   * socket inmediatamente.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.wsJwtGuard.authenticate(client);
      (client.data as ChatSocketData).user = user;
      this.logger.log(
        `Cliente conectado: ${client.id} (usuario ${user.userId})`,
      );
    } catch {
      this.logger.warn(`Conexión rechazada (auth): ${client.id}`);
      client.emit('error', 'No autenticado');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinConversation')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): { joined: string } {
    void client.join(this.room(data.conversationId));
    return { joined: data.conversationId };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveConversation')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): { left: string } {
    void client.leave(this.room(data.conversationId));
    return { left: data.conversationId };
  }

  /**
   * Recibe un mensaje, lo persiste y lo difunde a los demás participantes de
   * la sala en tiempo real. El emisor se determina desde el token, evitando
   * suplantación vía payload.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ): Promise<void> {
    const user = (client.data as ChatSocketData).user;
    if (!user) {
      throw new WsException('No autenticado');
    }
    const message = await this.chatService.sendMessage(user.userId, data);
    this.server.to(this.room(data.conversation)).emit('newMessage', message);
  }

  /**
   * Indica si un usuario está "activo" en una conversación, es decir, si tiene
   * al menos un socket unido a la sala de esa conversación (está viendo ese
   * chat en este momento). Usado por ChatService para omitir la notificación
   * de "nuevo mensaje" a los destinatarios que ya lo están viendo en vivo.
   */
  async isUserActiveInConversation(
    userId: string,
    conversationId: string,
  ): Promise<boolean> {
    const sockets = await this.server
      .in(this.room(conversationId))
      .fetchSockets();
    return sockets.some((socket) => {
      const data = socket.data as ChatSocketData;
      return data.user?.userId === userId;
    });
  }

  private room(conversationId: string): string {
    return `conversation:${conversationId}`;
  }
}
