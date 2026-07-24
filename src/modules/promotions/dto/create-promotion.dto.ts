import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ServiceCategory } from '../../services/enums/service-category.enum';
import {
  PromotionScope,
  PromotionType,
  TargetAudience,
} from '../enums/promotion.enums';

export class CreatePromotionDto {
  @ApiProperty({ example: 'Descuento de verano' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ enum: PromotionType })
  @IsEnum(PromotionType)
  type!: PromotionType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiProperty({ example: '2026-07-01' })
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @ApiProperty({ example: '2026-07-31' })
  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @ApiPropertyOptional({ enum: TargetAudience, default: TargetAudience.TODOS })
  @IsOptional()
  @IsEnum(TargetAudience)
  targetAudience?: TargetAudience;

  @ApiPropertyOptional({
    enum: PromotionScope,
    default: PromotionScope.TODOS,
    description: 'A qué aplica el descuento en el cálculo de precio',
  })
  @IsOptional()
  @IsEnum(PromotionScope)
  scope?: PromotionScope;

  // Requerido solo cuando scope=categoria.
  @ApiPropertyOptional({
    enum: ServiceCategory,
    description: 'Categoría afectada (solo si scope=categoria)',
  })
  @ValidateIf((o: CreatePromotionDto) => o.scope === PromotionScope.CATEGORIA)
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;

  // Requerido solo cuando scope=servicios.
  @ApiPropertyOptional({
    type: [String],
    description: 'IDs de servicios afectados (solo si scope=servicios)',
  })
  @ValidateIf((o: CreatePromotionDto) => o.scope === PromotionScope.SERVICIOS)
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  services?: string[];
}
