import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @MinLength(6)
  password!: string;
}
