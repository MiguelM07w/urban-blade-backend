import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ScheduleSlotDto } from './schedule-slot.dto';

export class CreateBarberDto {
  @ApiProperty({ description: 'ID del usuario asociado al barbero' })
  @IsMongoId()
  user!: string;

  @ApiPropertyOptional({ type: [String], example: ['fade', 'barba'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialty?: string[];

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  experience?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: [ScheduleSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  schedule?: ScheduleSlotDto[];
}
