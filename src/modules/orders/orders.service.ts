import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { extractId } from '../../common/utils';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentMethod, PaymentStatus } from '../payments/enums/payment.enums';
import { StripeService } from '../payments/stripe.service';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { CounterSaleDto } from './dto/counter-sale.dto';
import { CreateOrderDto, OrderItemInput } from './dto/create-order.dto';
import { OrderChannel, OrderStatus } from './enums/order-status.enum';
import { Order, OrderDocument, OrderItem } from './schemas/order.schema';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly productsService: ProductsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  // ---- Compra online (cliente) ----

  /**
   * Crea una compra online en estado PENDIENTE_PAGO. Congela nombre y precio de
   * cada producto y calcula el total. NO descuenta stock todavía (se descuenta
   * al confirmarse el pago), pero valida que haya stock disponible al crearla.
   */
  async create(clientId: string, dto: CreateOrderDto): Promise<OrderDocument> {
    const { items, total } = await this.buildItems(dto.items);
    return this.orderModel.create({
      orderNumber: await this.generateOrderNumber(),
      client: new Types.ObjectId(clientId),
      items,
      total,
      status: OrderStatus.PENDIENTE_PAGO,
      channel: OrderChannel.ONLINE,
    });
  }

  /**
   * Paga una compra online en EFECTIVO (se paga al recoger en el local): marca
   * la orden como pagada y descuenta el stock. El staff la confirma al entregar.
   * (Aquí "pagar en efectivo" reserva el producto; el cobro físico es al recoger.)
   */
  async payCash(orderId: string, clientId: string): Promise<OrderDocument> {
    const order = await this.getOwnedOrder(orderId, clientId);
    this.assertPayable(order);
    await this.commitStock(order);
    order.paymentMethod = PaymentMethod.EFECTIVO;
    order.paymentStatus = PaymentStatus.PENDIENTE; // se cobra al recoger
    order.status = OrderStatus.PAGADA;
    order.paidAt = new Date();
    await order.save();
    return order;
  }

  /**
   * Inicia el pago con TARJETA (Stripe) de una compra online. Crea el
   * PaymentIntent y devuelve el clientSecret. El stock se descuenta y la orden
   * pasa a PAGADA cuando Stripe confirma (webhook).
   */
  async payWithStripe(
    orderId: string,
    clientId: string,
  ): Promise<{ clientSecret: string; amount: number; currency: string }> {
    if (!this.stripeService.isEnabled()) {
      throw new BadRequestException(
        'Los pagos con tarjeta no están disponibles en este momento',
      );
    }
    const order = await this.getOwnedOrder(orderId, clientId);
    this.assertPayable(order);

    const currency = this.configService.get<string>('stripe.currency', 'usd');
    const intent = await this.stripeService.createPaymentIntent(
      order.total,
      currency,
      { orderId: order.id, clientId },
    );
    order.stripePaymentIntentId = intent.id;
    order.paymentMethod = PaymentMethod.STRIPE;
    await order.save();

    return {
      clientSecret: intent.client_secret ?? '',
      amount: order.total,
      currency,
    };
  }

  /**
   * Confirma el pago Stripe de una orden (desde el webhook): descuenta stock,
   * marca PAGADA y pagada. Idempotente.
   */
  async confirmStripePayment(paymentIntentId: string): Promise<void> {
    const order = await this.orderModel
      .findOne({ stripePaymentIntentId: paymentIntentId })
      .exec();
    if (!order) {
      return;
    }
    if (order.status !== OrderStatus.PENDIENTE_PAGO) {
      return; // ya procesada
    }
    await this.commitStock(order);
    order.paymentStatus = PaymentStatus.PAGADO;
    order.status = OrderStatus.PAGADA;
    order.paidAt = new Date();
    await order.save();
    this.logger.log(`Orden ${order.orderNumber} pagada con tarjeta`);
  }

  // ---- Venta en mostrador (staff) ----

  /**
   * Registra una venta presencial: descuenta stock y deja la orden pagada y
   * recogida en el acto. Cliente con cuenta (opcional) o invitado de mostrador.
   */
  async counterSale(dto: CounterSaleDto): Promise<OrderDocument> {
    const clientId = dto.client
      ? dto.client
      : (await this.usersService.getOrCreateGuestUser()).id;

    const { items, total } = await this.buildItems(dto.items);

    // Reservar stock atómicamente antes de crear la orden.
    const reserved: Array<{ product: string; quantity: number }> = [];
    for (const it of items) {
      const ok = await this.productsService.decrementStock(
        it.product.toString(),
        it.quantity,
      );
      if (!ok) {
        // Revertir lo ya descontado y abortar.
        await this.rollbackStock(reserved);
        throw new BadRequestException(`Stock insuficiente para "${it.name}"`);
      }
      reserved.push({ product: it.product.toString(), quantity: it.quantity });
    }

    const now = new Date();
    return this.orderModel.create({
      orderNumber: await this.generateOrderNumber(),
      client: new Types.ObjectId(clientId),
      items,
      total,
      status: OrderStatus.RECOGIDA,
      channel: OrderChannel.MOSTRADOR,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.EFECTIVO,
      paymentStatus: PaymentStatus.PAGADO,
      paidAt: now,
      readyAt: now,
      pickedUpAt: now,
    });
  }

  // ---- Gestión (staff) ----

  /**
   * Marca una orden pagada como LISTA para recoger y notifica al cliente.
   */
  async markReady(orderId: string): Promise<OrderDocument> {
    const order = await this.getActiveOrder(orderId);
    if (order.status !== OrderStatus.PAGADA) {
      throw new BadRequestException(
        'Solo una orden pagada puede marcarse como lista',
      );
    }
    order.status = OrderStatus.LISTA;
    order.readyAt = new Date();
    await order.save();

    await this.notify(
      extractId(order.client),
      'Tu compra está lista',
      `Tu pedido ${order.orderNumber} está listo para recoger en el local.`,
      order.id,
    );
    return order;
  }

  /**
   * Marca una orden como RECOGIDA (el cliente ya se la llevó).
   */
  async markPickedUp(orderId: string): Promise<OrderDocument> {
    const order = await this.getActiveOrder(orderId);
    if (
      order.status !== OrderStatus.LISTA &&
      order.status !== OrderStatus.PAGADA
    ) {
      throw new BadRequestException(
        'Solo una orden pagada o lista puede marcarse como recogida',
      );
    }
    order.status = OrderStatus.RECOGIDA;
    order.pickedUpAt = new Date();
    await order.save();
    return order;
  }

  /**
   * Cancela una orden. Si ya estaba pagada, devuelve el stock reservado.
   */
  async cancel(orderId: string): Promise<OrderDocument> {
    const order = await this.getActiveOrder(orderId);
    if (order.status === OrderStatus.RECOGIDA) {
      throw new BadRequestException('Una orden ya recogida no se cancela');
    }
    // Si el stock se había descontado (pagada/lista), se devuelve.
    if (
      order.status === OrderStatus.PAGADA ||
      order.status === OrderStatus.LISTA
    ) {
      for (const it of order.items) {
        await this.productsService.incrementStock(
          it.product.toString(),
          it.quantity,
        );
      }
    }
    order.status = OrderStatus.CANCELADA;
    await order.save();
    return order;
  }

  // ---- Consultas ----

  async findMine(clientId: string): Promise<OrderDocument[]> {
    this.assertValidId(clientId, 'clientId');
    return this.orderModel
      .find({ client: new Types.ObjectId(clientId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAll(): Promise<OrderDocument[]> {
    return this.orderModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<OrderDocument> {
    this.assertValidId(id);
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }
    return order;
  }

  // ---- Helpers ----

  /**
   * Valida los productos del carrito, congela nombre/precio y calcula subtotales
   * y total. Verifica que exista stock disponible al momento de armar la orden.
   */
  private async buildItems(
    inputs: OrderItemInput[],
  ): Promise<{ items: OrderItem[]; total: number }> {
    const items: OrderItem[] = [];
    let total = 0;
    for (const input of inputs) {
      const product = await this.productsService.findById(input.product);
      if (product.stock < input.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para "${product.name}" (disponible: ${product.stock})`,
        );
      }
      const subtotal = product.price * input.quantity;
      total += subtotal;
      items.push({
        product: new Types.ObjectId(product.id),
        name: product.name,
        unitPrice: product.price,
        quantity: input.quantity,
        subtotal,
      });
    }
    return { items, total: Math.round(total * 100) / 100 };
  }

  /**
   * Descuenta el stock de todos los items de una orden de forma atómica. Si
   * algún producto se quedó sin stock entre crear y pagar, revierte y falla.
   */
  private async commitStock(order: OrderDocument): Promise<void> {
    const reserved: Array<{ product: string; quantity: number }> = [];
    for (const it of order.items) {
      const ok = await this.productsService.decrementStock(
        it.product.toString(),
        it.quantity,
      );
      if (!ok) {
        await this.rollbackStock(reserved);
        throw new BadRequestException(
          `Stock insuficiente para "${it.name}"; alguien lo compró antes`,
        );
      }
      reserved.push({ product: it.product.toString(), quantity: it.quantity });
    }
  }

  private async rollbackStock(
    reserved: Array<{ product: string; quantity: number }>,
  ): Promise<void> {
    for (const r of reserved) {
      await this.productsService.incrementStock(r.product, r.quantity);
    }
  }

  private assertPayable(order: OrderDocument): void {
    if (order.status !== OrderStatus.PENDIENTE_PAGO) {
      throw new BadRequestException('Esta orden ya no está pendiente de pago');
    }
  }

  private async getOwnedOrder(
    orderId: string,
    clientId: string,
  ): Promise<OrderDocument> {
    const order = await this.findById(orderId);
    if (extractId(order.client) !== clientId) {
      throw new BadRequestException('Esta orden no te pertenece');
    }
    return order;
  }

  private async getActiveOrder(orderId: string): Promise<OrderDocument> {
    const order = await this.findById(orderId);
    if (order.status === OrderStatus.CANCELADA) {
      throw new BadRequestException('Esta orden está cancelada');
    }
    return order;
  }

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `OR-${year}-`;
    const last = await this.orderModel
      .findOne({ orderNumber: new RegExp(`^${prefix}`) })
      .sort({ orderNumber: -1 })
      .exec();
    let next = 1;
    if (last) {
      next = parseInt(last.orderNumber.split('-')[2] ?? '0', 10) + 1;
    }
    return `${prefix}${next.toString().padStart(4, '0')}`;
  }

  private async notify(
    userId: string,
    title: string,
    body: string,
    orderId: string,
  ): Promise<void> {
    try {
      await this.notificationsService.createForUser({
        userId,
        title,
        body,
        type: NotificationType.PROMOCION,
        data: { orderId },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo notificar la orden a ${userId}: ${(error as Error).message}`,
      );
    }
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
