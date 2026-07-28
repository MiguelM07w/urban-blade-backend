import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

/**
 * Verifica que un código de recuperación (6 dígitos) coincide con el del email,
 * sin cambiar la contraseña ni consumir el código. Paso intermedio del flujo:
 * el usuario teclea el código y se valida antes de pedirle la nueva contraseña.
 */
export class VerifyResetCodeDto {
  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '482137', description: 'Código de 6 dígitos' })
  @IsString()
  @Length(6, 6)
  code!: string;
}
