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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { StripeService } from '../payments/stripe.service';
import { CounterSaleDto } from './dto/counter-sale.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly stripeService: StripeService,
  ) {}

  @Post('stripe/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook de Stripe para compras (uso interno)' })
  async stripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
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
      await this.ordersService.confirmStripePayment(intent.id);
    }
    return { received: true };
  }

  // ---- Cliente ----

  @Post()
  @Roles(Role.CLIENT)
  @ResponseMessage('Compra creada')
  @ApiOperation({ summary: 'Crear compra de productos (carrito) — cliente' })
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(userId, dto);
  }

  @Patch(':id/pay-cash')
  @Roles(Role.CLIENT)
  @ResponseMessage('Compra confirmada (pago en el local)')
  @ApiOperation({
    summary: 'Pagar en efectivo al recoger (reserva el producto) — cliente',
  })
  payCash(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.ordersService.payCash(id, userId);
  }

  @Post(':id/pay-stripe')
  @Roles(Role.CLIENT)
  @ResponseMessage('Pago con tarjeta iniciado')
  @ApiOperation({
    summary: 'Pagar con tarjeta (Stripe) por adelantado — cliente',
  })
  payStripe(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.ordersService.payWithStripe(id, userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Mis compras' })
  findMine(@CurrentUser('userId') userId: string) {
    return this.ordersService.findMine(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver una compra' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  // ---- Staff ----

  @Post('counter-sale')
  @Roles(Role.ADMIN, Role.BARBER)
  @ResponseMessage('Venta registrada')
  @ApiOperation({
    summary: 'Registrar venta en mostrador (descuenta stock) — staff',
  })
  counterSale(@Body() dto: CounterSaleDto) {
    return this.ordersService.counterSale(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar todas las compras (admin)' })
  findAll() {
    return this.ordersService.findAll();
  }

  @Patch(':id/ready')
  @Roles(Role.ADMIN, Role.BARBER)
  @ResponseMessage('Compra lista para recoger')
  @ApiOperation({
    summary: 'Marcar como lista para recoger (avisa al cliente)',
  })
  markReady(@Param('id') id: string) {
    return this.ordersService.markReady(id);
  }

  @Patch(':id/picked-up')
  @Roles(Role.ADMIN, Role.BARBER)
  @ResponseMessage('Compra entregada')
  @ApiOperation({ summary: 'Marcar como recogida (entregada al cliente)' })
  markPickedUp(@Param('id') id: string) {
    return this.ordersService.markPickedUp(id);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN, Role.BARBER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Compra cancelada')
  @ApiOperation({
    summary: 'Cancelar compra (devuelve stock si estaba pagada)',
  })
  cancel(@Param('id') id: string) {
    return this.ordersService.cancel(id);
  }
}
