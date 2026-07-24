import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Role } from '../../common/enums';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { TrustScoreService } from './trust-score.service';

@ApiTags('trust-score')
@ApiBearerAuth()
@Controller('trust-score')
export class TrustScoreController {
  constructor(private readonly trustScoreService: TrustScoreService) {}

  @Get(':userId')
  @ApiOperation({ summary: 'Ver trust score del usuario' })
  findByUser(@Param('userId') userId: string) {
    return this.trustScoreService.findByUser(userId);
  }

  @Get(':userId/history')
  @ApiOperation({ summary: 'Historial de cambios del trust score' })
  getHistory(@Param('userId') userId: string) {
    return this.trustScoreService.getHistory(userId);
  }

  @Patch(':userId/restore')
  @Roles(Role.ADMIN)
  @Audit(AuditAction.TRUST_SCORE_RESTORED)
  @ResponseMessage('Trust score restaurado')
  @ApiOperation({ summary: 'Restaurar trust score manualmente (admin)' })
  restore(@Param('userId') userId: string) {
    return this.trustScoreService.restore(userId);
  }
}
