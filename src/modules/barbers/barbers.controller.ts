import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { AppointmentsService } from '../appointments/appointments.service';
import { BarbersService } from './barbers.service';
import { AddPortfolioDto } from './dto/add-portfolio.dto';
import { BarberOfTheDayDto } from './dto/barber-of-the-day.dto';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@ApiTags('barbers')
@Controller('barbers')
export class BarbersController {
  constructor(
    private readonly barbersService: BarbersService,
    @Inject(forwardRef(() => AppointmentsService))
    private readonly appointmentsService: AppointmentsService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Barbero creado')
  @ApiOperation({ summary: 'Crear perfil de barbero (admin)' })
  create(@Body() dto: CreateBarberDto) {
    return this.barbersService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar barberos activos' })
  findAll() {
    return this.barbersService.findAll();
  }

  @Get('barber-of-the-day')
  @Public()
  @ApiOperation({ summary: 'Obtener barbero del día' })
  getBarberOfTheDay() {
    return this.barbersService.getBarberOfTheDay();
  }

  @Get('me/profile')
  @ApiBearerAuth()
  @Roles(Role.BARBER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Perfil de barbero del usuario autenticado (para editar lo propio)',
  })
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.barbersService.findByUserId(user.userId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener barbero por ID' })
  findOne(@Param('id') id: string) {
    return this.barbersService.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.BARBER)
  @ResponseMessage('Barbero actualizado')
  @ApiOperation({ summary: 'Actualizar perfil de barbero' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBarberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.barbersService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Barbero eliminado')
  @ApiOperation({ summary: 'Eliminar barbero (soft delete)' })
  async remove(@Param('id') id: string) {
    await this.barbersService.remove(id);
    return null;
  }

  @Get(':id/portfolio')
  @Public()
  @ApiOperation({ summary: 'Ver portafolio del barbero' })
  getPortfolio(@Param('id') id: string) {
    return this.barbersService.getPortfolio(id);
  }

  @Post(':id/portfolio')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.BARBER)
  @ResponseMessage('Imagen agregada al portafolio')
  @ApiOperation({ summary: 'Subir foto al portafolio (Cloudinary)' })
  addPortfolio(
    @Param('id') id: string,
    @Body() dto: AddPortfolioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.barbersService.addPortfolioImage(id, dto.imageUrl, user);
  }

  @Delete(':id/portfolio')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.BARBER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Imagen eliminada del portafolio')
  @ApiOperation({ summary: 'Eliminar una foto del portafolio (por URL)' })
  removePortfolio(
    @Param('id') id: string,
    @Body() dto: AddPortfolioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.barbersService.removePortfolioImage(id, dto.imageUrl, user);
  }

  @Get(':id/schedule')
  @Public()
  @ApiOperation({ summary: 'Ver horarios del barbero' })
  getSchedule(@Param('id') id: string) {
    return this.barbersService.getSchedule(id);
  }

  @Patch(':id/schedule')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.BARBER)
  @ResponseMessage('Horarios actualizados')
  @ApiOperation({ summary: 'Actualizar horarios del barbero' })
  updateSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.barbersService.updateSchedule(id, dto.schedule, user);
  }

  @Get(':id/stats')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.BARBER)
  @ApiOperation({ summary: 'Estadísticas del barbero' })
  getStats(@Param('id') id: string) {
    return this.appointmentsService.getBarberStats(id);
  }

  @Get(':id/appointments')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.BARBER)
  @ApiQuery({ name: 'period', enum: ['day', 'week', 'month'], required: false })
  @ApiOperation({ summary: 'Citas del barbero (día/semana/mes)' })
  getAppointments(
    @Param('id') id: string,
    @Query('period') period: 'day' | 'week' | 'month' = 'day',
  ) {
    return this.appointmentsService.getBarberAppointments(id, period);
  }

  @Patch(':id/barber-of-the-day')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Barbero del día actualizado')
  @ApiOperation({ summary: 'Marcar como barbero del día (admin)' })
  setBarberOfTheDay(@Param('id') id: string, @Body() dto: BarberOfTheDayDto) {
    return this.barbersService.setBarberOfTheDay(id, dto.isBarberOfTheDay);
  }
}
