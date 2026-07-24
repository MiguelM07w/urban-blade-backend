import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsMongoId,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Una línea del carrito: producto + cantidad.
 */
export class OrderItemInput {
  @ApiProperty({ description: 'ID del producto' })
  @IsMongoId()
  product!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

/**
 * Compra online del cliente: arma el carrito y elige el momento de pago según
 * el flujo (efectivo al recoger, o tarjeta por adelantado con Stripe aparte).
 */
export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemInput], description: 'Items del carrito' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items!: OrderItemInput[];
}
