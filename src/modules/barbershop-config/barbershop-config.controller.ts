import {
  Body,
  Controller,
  forwardRef,
  Get,
  Inject,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AppointmentsService } from '../appointments/appointments.service';
import { BarbershopConfigService } from './barbershop-config.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { UpdateHolidaysDto } from './dto/update-holidays.dto';

@ApiTags('config')
@Controller('config')
export class BarbershopConfigController {
  constructor(
    private readonly configService: BarbershopConfigService,
    @Inject(forwardRef(() => AppointmentsService))
    private readonly appointmentsService: AppointmentsService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Obtener configuración de la barbería' })
  getConfig() {
    return this.configService.getOrCreate();
  }

  @Patch()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Configuración actualizada')
  @ApiOperation({ summary: 'Actualizar configuración (admin)' })
  updateConfig(@Body() dto: UpdateConfigDto) {
    return this.configService.update(dto);
  }

  @Get('map')
  @Public()
  @ApiOperation({ summary: 'Obtener coordenadas y links de mapa' })
  getMap() {
    return this.configService.getMap();
  }

  @Get('wait-time')
  @Public()
  @ApiOperation({ summary: 'Tiempo de espera actual en tiempo real' })
  getWaitTime() {
    // Se delega en appointments, que es la fuente real de las citas activas.
    return this.appointmentsService.getCurrentWaitTime();
  }

  @Patch('holidays')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Feriados actualizados')
  @ApiOperation({ summary: 'Gestionar días feriados (admin)' })
  updateHolidays(@Body() dto: UpdateHolidaysDto) {
    return this.configService.updateHolidays(dto.holidays);
  }
}
