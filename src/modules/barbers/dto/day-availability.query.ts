import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate } from 'class-validator';

/**
 * Query para la disponibilidad de un día concreto del barbero (para dibujar el
 * "reloj"/timeline: franjas de trabajo, citas y descansos).
 */
export class DayAvailabilityQuery {
  @ApiProperty({
    example: '2026-07-10',
    description: 'Fecha del día (YYYY-MM-DD)',
  })
  @Type(() => Date)
  @IsDate()
  date!: Date;
}
