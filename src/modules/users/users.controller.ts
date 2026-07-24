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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { AppointmentsService } from '../appointments/appointments.service';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { AuthProvider } from '../../common/enums';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => AppointmentsService))
    private readonly appointmentsService: AppointmentsService,
  ) {}

  @Post()
  @Public()
  @ResponseMessage('Usuario creado correctamente')
  @ApiOperation({ summary: 'Autorregistro de cliente (rol client forzado)' })
  create(@Body() dto: RegisterUserDto) {
    // El autorregistro público SIEMPRE crea un cliente con provider email;
    // el rol no se toma del body para evitar auto-escalada a admin/barber.
    return this.usersService.create({
      ...dto,
      role: Role.CLIENT,
      authProvider: AuthProvider.EMAIL,
    });
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar usuarios (admin)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.usersService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @ResponseMessage('Perfil actualizado')
  @ApiOperation({ summary: 'Actualizar perfil' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, user);
  }

  @Patch(':id/fcm-token')
  @ResponseMessage('Token de notificaciones actualizado')
  @ApiOperation({ summary: 'Actualizar token FCM del usuario' })
  updateFcmToken(
    @Param('id') id: string,
    @Body() dto: UpdateFcmTokenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateFcmToken(id, dto.fcmToken, user);
  }

  @Delete(':id')
  @Audit(AuditAction.USER_DELETED)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Usuario eliminado')
  @ApiOperation({ summary: 'Eliminar usuario (soft delete)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.usersService.remove(id, user);
    return null;
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Historial de cortes del usuario' })
  getHistory(@Param('id') id: string) {
    return this.appointmentsService.findByClient(id);
  }

  @Get(':id/favorites')
  @ApiOperation({ summary: 'Cortes favoritos del usuario' })
  getFavorites(@Param('id') id: string) {
    return this.usersService.getFavorites(id);
  }

  @Post(':id/favorites/:hairstyleId')
  @ResponseMessage('Favorito guardado')
  @ApiOperation({ summary: 'Guardar corte favorito' })
  addFavorite(
    @Param('id') id: string,
    @Param('hairstyleId') hairstyleId: string,
  ) {
    return this.usersService.addFavorite(id, hairstyleId);
  }
}
