import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '../../payments/enums/payment.enums';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Registro de una atención directa (walk-in) que el staff hace manualmente: un
 * cliente que se atendió sin reservar por la app. Crea una cita YA completada,
 * genera su ticket y registra el pago; ocupa el slot para que nadie más agende
 * esa hora. Para clientes con cuenta se pasa `client`; para personas sin cuenta
 * se pasa `guestName` (se registra contra el usuario invitado genérico).
 */
export class WalkInDto {
  @ApiProperty({ description: 'ID del barbero que atendió' })
  @IsMongoId()
  barber!: string;

  @ApiProperty({ description: 'ID del servicio realizado' })
  @IsMongoId()
  service!: string;

  @ApiProperty({ example: '2026-07-22', description: 'Fecha de la atención' })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiProperty({ example: '15:30', description: 'Hora de inicio (HH:mm)' })
  @Matches(HHMM, { message: 'startTime debe tener formato HH:mm' })
  startTime!: string;

  @ApiPropertyOptional({
    description: 'ID del cliente con cuenta (suma fidelización).',
  })
  @IsOptional()
  @IsMongoId()
  client?: string;

  @ApiPropertyOptional({
    description:
      'Nombre del cliente sin cuenta (walk-in anónimo). Si se envía, se ' +
      'registra contra el invitado de mostrador (sin fidelización).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  guestName?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    default: PaymentMethod.EFECTIVO,
    description: 'Método de pago (por defecto efectivo).',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Notas de la atención' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
