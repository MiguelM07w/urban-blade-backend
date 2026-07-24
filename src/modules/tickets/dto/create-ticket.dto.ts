import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod, PaymentStatus } from '../enums/ticket.enums';

/**
 * Copia de la promoción aplicada, para congelarla en el ticket.
 */
export class TicketPromotionDto {
  @ApiProperty()
  @IsMongoId()
  promotion!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty()
  @IsNumber()
  discountValue!: number;

  @ApiProperty()
  @IsString()
  scope!: string;
}

/**
 * Copia del cupón aplicado, para congelarlo en el ticket.
 */
export class TicketCouponDto {
  @ApiProperty()
  @IsMongoId()
  coupon!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  discountType!: string;

  @ApiProperty()
  @IsNumber()
  discountValue!: number;

  @ApiProperty()
  @IsNumber()
  discount!: number;
}

export class CreateTicketDto {
  @ApiProperty()
  @IsMongoId()
  appointment!: string;

  @ApiProperty()
  @IsMongoId()
  client!: string;

  @ApiProperty()
  @IsMongoId()
  barber!: string;

  @ApiProperty()
  @IsMongoId()
  service!: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  serviceDate!: Date;

  // Precio original antes de descuento. Si se omite, se asume igual a `price`.
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  // Monto descontado (0 si no hubo promo).
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ description: 'Precio final cobrado (basePrice - discount)' })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ type: TicketPromotionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TicketPromotionDto)
  appliedPromotion?: TicketPromotionDto;

  @ApiPropertyOptional({ type: TicketCouponDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TicketCouponDto)
  appliedCoupon?: TicketCouponDto;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.EFECTIVO })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    default: PaymentStatus.PENDIENTE,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Hairstyle seleccionado (opcional)' })
  @IsOptional()
  @IsMongoId()
  hairstyleSelected?: string;
}
