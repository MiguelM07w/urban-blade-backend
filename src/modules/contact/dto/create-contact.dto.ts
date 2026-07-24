import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Mensaje del formulario público "Contáctanos".
 */
export class CreateContactDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+50688887777' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ example: 'Hola, quisiera información sobre sus servicios.' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message!: string;
}
