import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, Matches } from 'class-validator';
import { DayOfWeek } from '../enums/day-of-week.enum';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ScheduleSlotDto {
  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @ApiProperty({ example: '09:00' })
  @Matches(HHMM, { message: 'startTime debe tener formato HH:mm' })
  startTime!: string;

  @ApiProperty({ example: '18:00' })
  @Matches(HHMM, { message: 'endTime debe tener formato HH:mm' })
  endTime!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
