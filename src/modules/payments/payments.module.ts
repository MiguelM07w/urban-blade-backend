import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketsModule } from '../tickets/tickets.module';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    TicketsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService],
  exports: [PaymentsService, StripeService],
})
export class PaymentsModule {}
