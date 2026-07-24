import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';
import { AuthProvider, Role } from '../../../common/enums';
import { FaceType, HairType } from '../enums/user.enums';

export class CreateUserDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ enum: HairType })
  @IsOptional()
  @IsEnum(HairType)
  hairType?: HairType;

  @ApiPropertyOptional({ enum: FaceType })
  @IsOptional()
  @IsEnum(FaceType)
  faceType?: FaceType;

  @ApiPropertyOptional({ enum: Role, default: Role.CLIENT })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: AuthProvider, default: AuthProvider.EMAIL })
  @IsOptional()
  @IsEnum(AuthProvider)
  authProvider?: AuthProvider;
}
