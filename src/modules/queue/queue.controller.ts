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
import { JoinQueueDto } from './dto/join-queue.dto';
import { MarkServedDto } from './dto/mark-served.dto';
import { QueueService } from './queue.service';

@ApiTags('queue')
@ApiBearerAuth()
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post()
  @ResponseMessage('Te uniste a la fila de espera')
  @ApiOperation({
    summary:
      'Unirse a la fila (cliente a sí mismo; staff registra a otro con `client`)',
  })
  join(@CurrentUser() user: AuthenticatedUser, @Body() dto: JoinQueueDto) {
    return this.queueService.join(user, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.BARBER)
  @ApiOperation({ summary: 'Ver la fila completa (staff)' })
  getQueue() {
    return this.queueService.getQueue();
  }

  @Get('me')
  @ApiOperation({ summary: 'Ver mi lugar en la fila (posición y espera)' })
  getMyEntry(@CurrentUser('userId') userId: string) {
    return this.queueService.getMyEntry(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Saliste de la fila')
  @ApiOperation({ summary: 'Salir de la fila (dueño o staff)' })
  async leave(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.queueService.leave(id, user);
    return null;
  }

  @Patch(':id/call')
  @Roles(Role.ADMIN, Role.BARBER)
  @ResponseMessage('Cliente llamado')
  @ApiOperation({ summary: 'Llamar al cliente (es su turno) — staff' })
  call(@Param('id') id: string) {
    return this.queueService.call(id);
  }

  @Patch(':id/served')
  @Roles(Role.ADMIN, Role.BARBER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Cliente atendido')
  @ApiOperation({
    summary:
      'Marcar atendido — staff. Genera ticket PENDIENTE de cobro (lo cobra el admin)',
  })
  async markServed(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkServedDto,
  ) {
    await this.queueService.markServed(id, user, dto.barberId);
    return null;
  }
}
