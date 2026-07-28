import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

/**
 * Restablece la contraseña con una de dos vías:
 *  - Código de 6 dígitos + email (el que llega en el correo, fácil de teclear).
 *  - Token JWT largo (compatibilidad con el enlace/deep link del correo).
 * Debe enviarse `code`+`email`, o bien `token`.
 */
export class ResetPasswordDto {
  @ApiPropertyOptional({
    description:
      'Código de 6 dígitos recibido por email (usar junto con email)',
    example: '482137',
  })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  code?: string;

  @ApiPropertyOptional({
    description: 'Email de la cuenta (requerido si se usa `code`)',
    example: 'juan@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Token JWT de recuperación (alternativa al código+email)',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiProperty({ example: 'NewPassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
