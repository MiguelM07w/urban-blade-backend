import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class QuoteQuery {
  @ApiProperty({ description: 'ID del servicio a cotizar' })
  @IsMongoId()
  service!: string;

  @ApiPropertyOptional({
    description:
      'Código de cupón a aplicar (opcional). Se acumula con la promoción ' +
      'vigente. Si no es válido, el quote devuelve `couponError` con el motivo.',
  })
  @IsOptional()
  @IsString()
  coupon?: string;
}
