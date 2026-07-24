import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Aplica un código de referido a la cuenta del usuario autenticado (lo vincula
 * con quien lo refirió y premia al referente). Uso único por usuario.
 */
export class ApplyReferralDto {
  @ApiProperty({
    description: 'Código de referido de otro usuario',
    example: 'A1B2C3D4',
  })
  @IsString()
  @MinLength(4)
  referralCode!: string;
}
