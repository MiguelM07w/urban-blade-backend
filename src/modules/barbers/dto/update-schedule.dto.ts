import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { ScheduleSlotDto } from './schedule-slot.dto';

export class UpdateScheduleDto {
  @ApiProperty({ type: [ScheduleSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  schedule!: ScheduleSlotDto[];
}
