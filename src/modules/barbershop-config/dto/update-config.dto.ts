import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Coordenadas geográficas.
 */
export class CoordinatesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;
}

/**
 * Horario de apertura por día.
 */
export class OpeningHourDto {
  @ApiPropertyOptional({ example: 'lunes' })
  @IsString()
  dayOfWeek!: string;

  @ApiPropertyOptional({ example: '09:00' })
  @Matches(HHMM, { message: 'startTime debe tener formato HH:mm' })
  startTime!: string;

  @ApiPropertyOptional({ example: '18:00' })
  @Matches(HHMM, { message: 'endTime debe tener formato HH:mm' })
  endTime!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}

/**
 * Enlaces de redes sociales.
 */
export class SocialMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instagram?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facebook?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tiktok?: string;
}

/**
 * Actualización parcial de la configuración de la barbería (admin).
 */
export class UpdateConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ type: CoordinatesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googleMapsUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wazeUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ type: [OpeningHourDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningHourDto)
  openingHours?: OpeningHourDto[];

  @ApiPropertyOptional({ type: SocialMediaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialMediaDto)
  socialMedia?: SocialMediaDto;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAppointmentsPerSlot?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  slotDuration?: number;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationWindowHours?: number;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  doubleCheckHoursBeforeAppointment?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;
}
