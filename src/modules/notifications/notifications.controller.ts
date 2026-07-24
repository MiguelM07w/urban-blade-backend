import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get(':userId')
  @ApiOperation({ summary: 'Listar notificaciones del usuario' })
  findByUser(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.findByUser(userId, user);
  }

  @Patch(':id/read')
  @ResponseMessage('Notificación marcada como leída')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  markAsRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAsRead(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Notificación eliminada')
  @ApiOperation({ summary: 'Eliminar notificación' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.notificationsService.remove(id, user);
    return null;
  }

  @Post('send')
  @Roles(Role.ADMIN)
  @ResponseMessage('Notificación enviada')
  @ApiOperation({ summary: 'Enviar notificación manual (admin)' })
  send(@Body() dto: SendNotificationDto) {
    return this.notificationsService.send(dto);
  }

  @Post('broadcast')
  @Roles(Role.ADMIN)
  @ResponseMessage('Notificación difundida')
  @ApiOperation({ summary: 'Enviar notificación a todos los usuarios (admin)' })
  broadcast(@Body() dto: BroadcastNotificationDto) {
    return this.notificationsService.broadcast(dto);
  }
}
