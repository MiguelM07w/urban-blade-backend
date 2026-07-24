import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Canje de un cupón por parte del usuario autenticado.
 */
export class RedeemDto {
  @ApiProperty({ example: 'VERANO20', description: 'Código del cupón a canjear' })
  @IsString()
  @MinLength(3)
  code!: string;
}
