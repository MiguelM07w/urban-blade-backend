import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

/**
 * El cliente comparte con un barbero el estilo elegido tras la recomendación.
 */
export class ShareWithBarberDto {
  @ApiProperty({ description: 'ID del barbero con quien compartir el estilo' })
  @IsMongoId()
  barber!: string;

  @ApiProperty({ description: 'ID del hairstyle elegido' })
  @IsMongoId()
  hairstyle!: string;
}
