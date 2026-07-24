import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '../enums/payment.enums';

/**
 * Registro de un pago en efectivo asociado a un ticket. El monto y el cliente
 * se toman del ticket para garantizar consistencia.
 */
export class CreatePaymentDto {
  @ApiProperty({ description: 'ID del ticket a pagar' })
  @IsMongoId()
  ticket!: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.EFECTIVO })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
