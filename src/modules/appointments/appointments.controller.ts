import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';
import { TrustScoreGuard } from '../../common/guards/trust-score.guard';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { AppointmentsService } from './appointments.service';
import { AvailableSlotsQuery } from './dto/available-slots.query';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { QuoteQuery } from './dto/quote.query';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { WalkInDto } from './dto/walk-in.dto';
import { AppointmentStatus } from './enums/appointment.enums';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles(Role.CLIENT)
  @UseGuards(TrustScoreGuard)
  @ResponseMessage('Cita creada')
  @ApiOperation({ summary: 'Crear cita (solo cliente)' })
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(userId, dto);
  }

  @Post('walk-in')
  @Roles(Role.ADMIN, Role.BARBER)
  @ResponseMessage('Atención registrada')
  @ApiOperation({
    summary:
      'Registrar atención directa (walk-in): crea cita completada + ticket. ' +
      'El admin cobra en el acto; el barbero deja el ticket pendiente de cobro.',
  })
  walkIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: WalkInDto) {
    return this.appointmentsService.walkIn(dto, user.role);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar citas (admin)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.appointmentsService.findAll(pagination);
  }

  @Get('available-slots')
  @Public()
  @ApiOperation({ summary: 'Slots disponibles por barbero y fecha' })
  availableSlots(@Query() query: AvailableSlotsQuery) {
    return this.appointmentsService.getAvailableSlots(
      query.barber,
      query.date,
      query.service,
    );
  }

  @Get('quote')
  @ApiOperation({
    summary:
      'Cotizar precio de un servicio con la mejor promoción vigente aplicada',
  })
  quote(@Query() query: QuoteQuery, @CurrentUser('userId') userId: string) {
    return this.appointmentsService.quote(
      query.service,
      userId,
      undefined,
      query.coupon,
    );
  }

  @Get('wait-time')
  @Public()
  @ApiOperation({ summary: 'Tiempo estimado de espera actual' })
  waitTime() {
    return this.appointmentsService.getCurrentWaitTime();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cita por ID' })
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findById(id);
  }

  @Patch(':id/status')
  @Roles(Role.BARBER, Role.ADMIN)
  @Audit(AuditAction.APPOINTMENT_STATUS_CHANGED)
  @ResponseMessage('Estado de la cita actualizado')
  @ApiOperation({
    summary: 'Cambiar estado (barbero: confirmada/completada/cancelada)',
  })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.appointmentsService.updateStatus(
      id,
      dto.status as unknown as AppointmentStatus,
      dto.cancelReason,
    );
  }

  @Patch(':id/cancel')
  @Roles(Role.CLIENT)
  @Audit(AuditAction.APPOINTMENT_CANCELLED)
  @ResponseMessage('Cita cancelada')
  @ApiOperation({ summary: 'Cancelar cita (solo cliente)' })
  cancel(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancelByClient(
      id,
      userId,
      dto.cancelReason,
    );
  }

  @Patch(':id/confirm')
  @Roles(Role.CLIENT)
  @ResponseMessage('Asistencia confirmada')
  @ApiOperation({ summary: 'Confirmar asistencia (doble check, solo cliente)' })
  confirm(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.appointmentsService.confirmByClient(id, userId);
  }

  @Patch(':id/reschedule')
  @Roles(Role.CLIENT)
  @UseGuards(TrustScoreGuard)
  @ResponseMessage('Cita reprogramada')
  @ApiOperation({ summary: 'Reprogramar cita (solo cliente)' })
  reschedule(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(id, userId, dto);
  }
}
