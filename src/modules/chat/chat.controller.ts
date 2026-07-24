import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @ResponseMessage('Conversación creada')
  @ApiOperation({ summary: 'Crear conversación' })
  createConversation(@Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(dto);
  }

  @Get('conversations/:userId')
  @ApiOperation({ summary: 'Listar conversaciones del usuario' })
  findConversations(@Param('userId') userId: string) {
    return this.chatService.findConversationsByUser(userId);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Ver mensajes de una conversación' })
  findMessages(@Param('conversationId') conversationId: string) {
    return this.chatService.findMessages(conversationId);
  }

  @Post('messages')
  @ResponseMessage('Mensaje enviado')
  @ApiOperation({ summary: 'Enviar mensaje (REST; también disponible por WS)' })
  sendMessage(
    @CurrentUser('userId') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(userId, dto);
  }

  @Patch('messages/:id/read')
  @ResponseMessage('Mensaje marcado como leído')
  @ApiOperation({ summary: 'Marcar mensaje como leído' })
  markAsRead(@Param('id') id: string) {
    return this.chatService.markAsRead(id);
  }
}
