import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../payments/enums/payment.enums';
import { OrderItemInput } from './create-order.dto';

/**
 * Venta en mostrador registrada por el staff: descuenta stock y queda pagada +
 * recogida en el acto (el cliente se lleva el producto). Para persona sin cuenta
 * se usa `guestName` (invitado de mostrador).
 */
export class CounterSaleDto {
  @ApiProperty({ type: [OrderItemInput] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items!: OrderItemInput[];

  @ApiPropertyOptional({ description: 'ID del cliente con cuenta (opcional)' })
  @IsOptional()
  @IsMongoId()
  client?: string;

  @ApiPropertyOptional({ description: 'Nombre del cliente sin cuenta' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  guestName?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    default: PaymentMethod.EFECTIVO,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
