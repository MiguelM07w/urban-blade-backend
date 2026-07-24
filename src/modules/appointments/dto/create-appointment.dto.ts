import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { RecurringType } from '../enums/appointment.enums';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateAppointmentDto {
  @ApiProperty({ description: 'ID del barbero' })
  @IsMongoId()
  barber!: string;

  @ApiProperty({ description: 'ID del servicio' })
  @IsMongoId()
  service!: string;

  @ApiProperty({ example: '2026-07-10', description: 'Fecha de la cita' })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiProperty({ example: '15:30', description: 'Hora de inicio (HH:mm)' })
  @Matches(HHMM, { message: 'startTime debe tener formato HH:mm' })
  startTime!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ enum: RecurringType })
  @IsOptional()
  @IsEnum(RecurringType)
  recurringType?: RecurringType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Hairstyle seleccionado (opcional)' })
  @IsOptional()
  @IsMongoId()
  styleSelected?: string;

  @ApiPropertyOptional({
    description:
      'Código de cupón a aplicar en la cita. Se valida al reservar y su ' +
      'descuento se congela en el ticket al completar.',
  })
  @IsOptional()
  @IsString()
  coupon?: string;
}
