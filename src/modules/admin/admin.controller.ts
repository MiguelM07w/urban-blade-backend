import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AdminService } from './admin.service';
import { BlockUserDto } from './dto/block-user.dto';
import { ChangeRoleDto } from './dto/change-role.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Panel de control con métricas consolidadas' })
  dashboard() {
    return this.adminService.dashboard();
  }

  @Post('users')
  @Audit(AuditAction.USER_CREATED)
  @ResponseMessage('Usuario creado')
  @ApiOperation({
    summary: 'Crear usuario con rol (admin). Si es barbero, crea su perfil.',
  })
  createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Patch('users/:id/block')
  @Audit(AuditAction.USER_BLOCKED)
  @ResponseMessage('Usuario bloqueado')
  @ApiOperation({ summary: 'Bloquear usuario' })
  blockUser(@Param('id') id: string, @Body() dto: BlockUserDto) {
    return this.adminService.blockUser(id, dto.blockedUntil);
  }

  @Patch('users/:id/unblock')
  @Audit(AuditAction.USER_UNBLOCKED)
  @ResponseMessage('Usuario desbloqueado')
  @ApiOperation({ summary: 'Desbloquear usuario' })
  unblockUser(@Param('id') id: string) {
    return this.adminService.unblockUser(id);
  }

  @Patch('users/:id/role')
  @Audit(AuditAction.USER_ROLE_CHANGED)
  @ResponseMessage('Rol actualizado')
  @ApiOperation({ summary: 'Cambiar rol de usuario' })
  changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.adminService.changeRole(id, dto.role);
  }
}
