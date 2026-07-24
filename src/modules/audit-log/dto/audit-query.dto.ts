import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AuditAction } from '../enums/audit-action.enum';

export class AuditQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AuditAction, description: 'Filtrar por acción' })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'Filtrar por id del actor (usuario)' })
  @IsOptional()
  @IsMongoId()
  actor?: string;
}
