import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuditLogService } from './audit-log.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar registros de auditoría (admin), paginado y filtrable',
  })
  findAll(@Query() query: AuditQueryDto) {
    return this.auditLogService.findAll({
      page: query.page,
      limit: query.limit,
      action: query.action,
      actor: query.actor,
    });
  }
}
