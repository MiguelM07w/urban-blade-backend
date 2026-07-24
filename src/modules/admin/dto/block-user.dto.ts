import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class BlockUserDto {
  @ApiPropertyOptional({
    description: 'Fecha hasta la que se bloquea. Si se omite, es permanente.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  blockedUntil?: Date;
}
