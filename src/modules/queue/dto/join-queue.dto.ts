import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Unirse a la fila virtual. Tres modos:
 * - Cliente autenticado a sí mismo: solo `service` (+ `barber` opcional).
 * - Staff registra a un cliente con cuenta: además `client`.
 * - Staff registra a un invitado sin cuenta: además `guestName` (+ `guestPhone`).
 */
export class JoinQueueDto {
  @ApiProperty({ description: 'ID del servicio solicitado' })
  @IsMongoId()
  service!: string;

  @ApiPropertyOptional({
    description: 'ID del barbero preferido (opcional = cualquiera)',
  })
  @IsOptional()
  @IsMongoId()
  barber?: string;

  @ApiPropertyOptional({
    description:
      'ID del cliente. Solo lo usa el staff para registrar a otra persona; ' +
      'un cliente que se une a sí mismo NO lo envía (se toma del token).',
  })
  @IsOptional()
  @IsMongoId()
  client?: string;

  @ApiPropertyOptional({
    description:
      'Nombre del invitado sin cuenta (walk-in anónimo). Solo staff. Si se ' +
      'envía, la entrada se crea como invitado (sin `client`).',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  guestName?: string;

  @ApiPropertyOptional({ description: 'Teléfono del invitado (opcional)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  guestPhone?: string;
}
