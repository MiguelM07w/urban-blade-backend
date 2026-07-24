import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de recuperación recibido por email' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'NewPassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
