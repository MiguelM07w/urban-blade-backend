import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ServiceCategory } from '../enums/service-category.enum';

export class CreateServiceDto {
  @ApiProperty({ example: 'Corte clásico' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 12 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 30, description: 'Duración en minutos' })
  @IsInt()
  @Min(1)
  duration!: number;

  @ApiProperty({ enum: ServiceCategory })
  @IsEnum(ServiceCategory)
  category!: ServiceCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMonthlyFeatured?: boolean;
}
