import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsMongoId, IsOptional } from 'class-validator';

export class AvailableSlotsQuery {
  @ApiProperty({ description: 'ID del barbero' })
  @IsMongoId()
  barber!: string;

  @ApiProperty({ example: '2026-07-10' })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiPropertyOptional({
    description:
      'ID del servicio. Si se envía, los slots reservan el bloque completo ' +
      'de su duración; si se omite, se usan bloques de 30 min.',
  })
  @IsOptional()
  @IsMongoId()
  service?: string;
}
