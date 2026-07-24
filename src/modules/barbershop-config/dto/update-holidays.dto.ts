import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * Un feriado individual.
 */
export class HolidayDto {
  @ApiProperty({ example: '2026-12-25' })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiPropertyOptional({ example: 'Navidad' })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Reemplaza por completo la lista de feriados de la barbería.
 */
export class UpdateHolidaysDto {
  @ApiProperty({ type: [HolidayDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HolidayDto)
  holidays!: HolidayDto[];
}
