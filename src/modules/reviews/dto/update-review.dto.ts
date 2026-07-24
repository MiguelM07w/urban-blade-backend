import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

/**
 * Edición de reseña por su autor. Sólo campos de contenido; no se puede
 * cambiar la cita ni el barbero asociados.
 */
export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photos?: string[];
}
