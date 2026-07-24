import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

/**
 * Periodo de agrupación para los reportes temporales.
 */
export enum ReportPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class ReportQueryDto {
  @ApiPropertyOptional({
    enum: ReportPeriod,
    default: ReportPeriod.DAILY,
    description: 'Periodo de agrupación',
  })
  @IsOptional()
  @IsEnum(ReportPeriod)
  period: ReportPeriod = ReportPeriod.DAILY;
}
