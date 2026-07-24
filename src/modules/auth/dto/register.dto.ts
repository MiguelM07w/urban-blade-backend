import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: '+50688887777' })
  @IsOptional()
  @IsPhoneNumber(undefined)
  phone?: string;
}
