import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateStripeIntentDto } from './dto/create-stripe-intent.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Pago registrado')
  @ApiOperation({
    summary: 'Registrar pago en efectivo (solo admin/recepción)',
  })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Post('stripe/intent')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Intento de pago creado')
  @ApiOperation({
    summary: 'Iniciar pago con tarjeta (Stripe) sobre un ticket (solo admin)',
  })
  createStripeIntent(@Body() dto: CreateStripeIntentDto) {
    return this.paymentsService.createStripeIntent(dto.ticket);
  }

  @Post('stripe/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook de Stripe (uso interno de la pasarela)' })
  async stripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    // El raw body se preserva en main.ts para verificar la firma del webhook.
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || !signature) {
      throw new BadRequestException('Webhook inválido');
    }
    let event;
    try {
      event = this.stripeService.constructEvent(rawBody, signature);
    } catch {
      throw new BadRequestException('Firma del webhook no válida');
    }
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as { id: string };
      await this.paymentsService.confirmStripePayment(intent.id);
    }
    return { received: true };
  }

  @Get()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar pagos (admin)' })
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get('client/:clientId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historial de pagos del cliente' })
  findByClient(@Param('clientId') clientId: string) {
    return this.paymentsService.findByClient(clientId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener pago por ID' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Estado del pago actualizado')
  @ApiOperation({ summary: 'Actualizar estado del pago (reembolso, etc.)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePaymentStatusDto) {
    return this.paymentsService.updateStatus(id, dto.status);
  }
}
