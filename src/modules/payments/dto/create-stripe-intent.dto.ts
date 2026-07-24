import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

/**
 * Solicita crear un PaymentIntent de Stripe para pagar un ticket con tarjeta.
 * El monto se toma del ticket (no del cliente).
 */
export class CreateStripeIntentDto {
  @ApiProperty({ description: 'ID del ticket a pagar' })
  @IsMongoId()
  ticket!: string;
}
