import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { DiscountType } from '../enums/loyalty.enums';

export class CreateCouponDto {
  @ApiProperty({ example: 'VERANO20' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @ApiProperty({ example: 20, description: 'Valor del descuento' })
  @IsNumber()
  @Min(0)
  discountValue!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minVisitsRequired?: number;

  @ApiProperty({ example: '2026-12-31' })
  @Type(() => Date)
  @IsDate()
  expiresAt!: Date;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;
}
