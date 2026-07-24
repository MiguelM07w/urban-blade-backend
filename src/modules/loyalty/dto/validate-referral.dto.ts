import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Validación de un código de referido durante el registro/onboarding.
 */
export class ValidateReferralDto {
  @ApiProperty({ description: 'Código de referido a validar' })
  @IsString()
  @MinLength(4)
  referralCode!: string;
}
