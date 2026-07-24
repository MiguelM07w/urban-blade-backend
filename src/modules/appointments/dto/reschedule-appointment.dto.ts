import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, Matches } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class RescheduleAppointmentDto {
  @ApiProperty({ example: '2026-07-12' })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiProperty({ example: '16:00' })
  @Matches(HHMM, { message: 'startTime debe tener formato HH:mm' })
  startTime!: string;
}
