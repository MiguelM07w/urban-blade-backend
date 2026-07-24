import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PaymentStatus } from '../enums/payment.enums';

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;
}
