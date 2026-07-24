import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AppointmentStatus } from '../enums/appointment.enums';

/**
 * El barbero solo puede transicionar a estos estados.
 */
export enum BarberSettableStatus {
  CONFIRMADA = AppointmentStatus.CONFIRMADA,
  COMPLETADA = AppointmentStatus.COMPLETADA,
  CANCELADA = AppointmentStatus.CANCELADA,
  NO_ASISTIO = AppointmentStatus.NO_ASISTIO,
}

export class UpdateStatusDto {
  @ApiProperty({ enum: BarberSettableStatus })
  @IsEnum(BarberSettableStatus)
  status!: BarberSettableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cancelReason?: string;
}
