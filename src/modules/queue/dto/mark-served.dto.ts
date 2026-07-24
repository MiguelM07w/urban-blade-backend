import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

/**
 * Datos opcionales al marcar una entrada de fila como atendida. `barberId` solo
 * es necesario cuando la entrada no fijaba barbero ("cualquiera") y quien la
 * marca no es un barbero (p. ej. un admin): en ese caso hay que indicar qué
 * barbero atendió para generar el ticket.
 */
export class MarkServedDto {
  @ApiPropertyOptional({
    description:
      'ID del barbero que atendió (obligatorio si la entrada no fijaba barbero ' +
      'y quien marca atendido no es barbero).',
  })
  @IsOptional()
  @IsMongoId()
  barberId?: string;
}
