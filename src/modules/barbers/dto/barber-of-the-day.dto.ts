import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class BarberOfTheDayDto {
  @ApiProperty({ description: 'Marcar o desmarcar como barbero del día' })
  @IsBoolean()
  isBarberOfTheDay!: boolean;
}
