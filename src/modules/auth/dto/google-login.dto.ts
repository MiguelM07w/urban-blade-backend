import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'ID token de Google obtenido en el móvil (Google Sign-In)',
  })
  @IsString()
  idToken!: string;
}
