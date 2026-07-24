import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsMongoId,
  IsOptional,
  Matches,
  ValidateNested,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Rango horario preferido.
 */
export class PreferredTimeRangeDto {
  @ApiProperty({ example: '10:00' })
  @Matches(HHMM, { message: 'start debe tener formato HH:mm' })
  start!: string;

  @ApiProperty({ example: '13:00' })
  @Matches(HHMM, { message: 'end debe tener formato HH:mm' })
  end!: string;
}

export class JoinWaitingListDto {
  // Opcional: si se omite, aplica para cualquier barbero.
  @ApiPropertyOptional({ description: 'ID del barbero preferido (opcional)' })
  @IsOptional()
  @IsMongoId()
  barber?: string;

  @ApiProperty({ description: 'ID del servicio deseado' })
  @IsMongoId()
  service!: string;

  @ApiProperty({ example: '2026-07-15' })
  @Type(() => Date)
  @IsDate()
  preferredDate!: Date;

  @ApiPropertyOptional({ type: PreferredTimeRangeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PreferredTimeRangeDto)
  preferredTimeRange?: PreferredTimeRangeDto;
}
