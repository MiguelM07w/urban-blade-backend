import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { FaceType, HairType } from '../../users/enums/user.enums';
import { HairstyleCategory } from '../enums/hairstyle-category.enum';

export class CreateHairstyleDto {
  @ApiProperty({ example: 'Fade texturizado' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: FaceType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(FaceType, { each: true })
  faceTypes?: FaceType[];

  @ApiPropertyOptional({ enum: HairType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(HairType, { each: true })
  hairTypes?: HairType[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'PNG para overlay 2D' })
  @IsOptional()
  @IsString()
  overlayImage?: string;

  @ApiProperty({ enum: HairstyleCategory })
  @IsEnum(HairstyleCategory)
  category!: HairstyleCategory;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isTrending?: boolean;
}
