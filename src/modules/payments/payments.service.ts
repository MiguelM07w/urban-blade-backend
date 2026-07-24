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
import { PaymentMethod as TicketPaymentMethod } from '../tickets/enums/ticket.enums';
import { TicketsService } from '../tickets/tickets.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentMethod, PaymentStatus } from './enums/payment.enums';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    private readonly ticketsService: TicketsService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Registra un pago en efectivo. El monto y el cliente se toman del ticket
   * para evitar inconsistencias. Al registrarse, el pago queda como PAGADO y
   * el ticket se marca como pagado.
   */
  async create(dto: CreatePaymentDto): Promise<PaymentDocument> {
    const ticket = await this.ticketsService.findById(dto.ticket);

    // Evitar pagos duplicados sobre el mismo ticket.
    const existing = await this.paymentModel
      .findOne({
        ticket: new Types.ObjectId(ticket.id),
        status: PaymentStatus.PAGADO,
      })
      .exec();
    if (existing) {
      throw new BadRequestException('Este ticket ya tiene un pago registrado');
    }

    const payment = await this.paymentModel.create({
      ticket: new Types.ObjectId(ticket.id),
      client: ticket.client,
      amount: ticket.price,
      method: dto.method ?? PaymentMethod.EFECTIVO,
      status: PaymentStatus.PAGADO,
      paidAt: new Date(),
      notes: dto.notes ?? '',
    });

    // Sincroniza el estado y el método de pago en el ticket.
    await this.ticketsService.markAsPaid(
      ticket.id,
      this.toTicketMethod(payment.method),
    );

    return payment;
  }

  /**
   * Traduce el método del módulo de pagos al enum del ticket. El pago con
   * pasarela (stripe) se refleja en el recibo como "tarjeta".
   */
  private toTicketMethod(method: PaymentMethod): TicketPaymentMethod {
    return method === PaymentMethod.STRIPE
      ? TicketPaymentMethod.TARJETA
      : TicketPaymentMethod.EFECTIVO;
  }

  /**
   * Inicia un pago con tarjeta (Stripe) sobre un ticket. Crea un PaymentIntent
   * en Stripe y un Payment local en estado PENDIENTE con su id. Devuelve el
   * `clientSecret` para que el móvil complete el cobro con el SDK de Stripe. El
   * pago se confirma después vía webhook (`payment_intent.succeeded`).
   */
  async createStripeIntent(ticketId: string): Promise<{
    clientSecret: string;
    paymentId: string;
    amount: number;
    currency: string;
  }> {
    if (!this.stripeService.isEnabled()) {
      throw new BadRequestException(
        'Los pagos con tarjeta no están disponibles en este momento',
      );
    }
    const ticket = await this.ticketsService.findById(ticketId);

    // Evitar doble pago del mismo ticket.
    const paid = await this.paymentModel
      .findOne({
        ticket: new Types.ObjectId(ticket.id),
        status: PaymentStatus.PAGADO,
      })
      .exec();
    if (paid) {
      throw new BadRequestException('Este ticket ya tiene un pago registrado');
    }

    const currency = this.configService.get<string>('stripe.currency', 'usd');
    const intent = await this.stripeService.createPaymentIntent(
      ticket.price,
      currency,
      { ticketId: ticket.id, clientId: ticket.client.toString() },
    );

    // Reutiliza un Payment pendiente previo del mismo ticket, o crea uno nuevo.
    await this.paymentModel
      .findOneAndUpdate(
        {
          ticket: new Types.ObjectId(ticket.id),
          status: PaymentStatus.PENDIENTE,
          method: PaymentMethod.STRIPE,
        },
        {
          ticket: new Types.ObjectId(ticket.id),
          client: ticket.client,
          amount: ticket.price,
          method: PaymentMethod.STRIPE,
          status: PaymentStatus.PENDIENTE,
          stripePaymentIntentId: intent.id,
        },
        { upsert: true, new: true },
      )
      .exec();

    const payment = await this.paymentModel
      .findOne({ stripePaymentIntentId: intent.id })
      .exec();

    return {
      clientSecret: intent.client_secret ?? '',
      paymentId: payment?.id ?? '',
      amount: ticket.price,
      currency,
    };
  }

  /**
   * Marca como PAGADO el pago de Stripe asociado a un PaymentIntent (llamado
   * desde el webhook al confirmar Stripe el cobro). Idempotente. También marca
   * el ticket como pagado.
   */
  async confirmStripePayment(paymentIntentId: string): Promise<void> {
    const payment = await this.paymentModel
      .findOne({ stripePaymentIntentId: paymentIntentId })
      .exec();
    if (!payment) {
      this.logger.warn(
        `Webhook: no se encontró pago para el intent ${paymentIntentId}`,
      );
      return;
    }
    if (payment.status === PaymentStatus.PAGADO) {
      return; // ya confirmado
    }
    payment.status = PaymentStatus.PAGADO;
    payment.paidAt = new Date();
    await payment.save();
    await this.ticketsService.markAsPaid(
      extractId(payment.ticket),
      this.toTicketMethod(payment.method),
    );
    this.logger.log(`Pago Stripe confirmado para el intent ${paymentIntentId}`);
  }

  async findAll(): Promise<PaymentDocument[]> {
    return this.paymentModel
      .find()
      .populate('ticket', 'ticketNumber price')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(id: string): Promise<PaymentDocument> {
    this.assertValidId(id);
    const payment = await this.paymentModel
      .findById(id)
      .populate('ticket', 'ticketNumber price')
      .exec();
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }
    return payment;
  }

  async findByClient(clientId: string): Promise<PaymentDocument[]> {
    this.assertValidId(clientId, 'clientId');
    return this.paymentModel
      .find({ client: new Types.ObjectId(clientId) })
      .populate('ticket', 'ticketNumber price')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Actualiza el estado del pago. Si pasa a REEMBOLSADO y es un pago con tarjeta
   * (Stripe) ya pagado, ejecuta el reembolso REAL en Stripe (devuelve el dinero
   * a la tarjeta). Para efectivo, solo cambia el estado local (el reembolso se
   * gestiona en persona). Si pasa a PAGADO fija paidAt; si no, lo limpia.
   */
  async updateStatus(
    id: string,
    status: PaymentStatus,
  ): Promise<PaymentDocument> {
    const payment = await this.findById(id);

    if (status === PaymentStatus.REEMBOLSADO) {
      await this.processRefund(payment);
      // El ticket deja de estar pagado tras el reembolso. `ticket` puede venir
      // poblado (findById lo puebla), por eso se extrae el id de forma segura.
      await this.ticketsService.markAsUnpaid(extractId(payment.ticket));
    }

    payment.status = status;
    payment.paidAt = status === PaymentStatus.PAGADO ? new Date() : null;
    await payment.save();
    return payment;
  }

  /**
   * Ejecuta el reembolso real en Stripe para un pago con tarjeta. Valida que el
   * pago esté en un estado reembolsable y que Stripe esté disponible. Para pagos
   * en efectivo no hace nada (el reembolso es en persona).
   */
  private async processRefund(payment: PaymentDocument): Promise<void> {
    if (payment.status === PaymentStatus.REEMBOLSADO) {
      throw new BadRequestException('Este pago ya fue reembolsado');
    }
    // Solo Stripe tiene reembolso automático; efectivo se resuelve en persona.
    if (
      payment.method !== PaymentMethod.STRIPE ||
      !payment.stripePaymentIntentId
    ) {
      return;
    }
    if (payment.status !== PaymentStatus.PAGADO) {
      throw new BadRequestException(
        'Solo se puede reembolsar un pago que esté pagado',
      );
    }
    if (!this.stripeService.isEnabled()) {
      throw new BadRequestException(
        'El reembolso con tarjeta no está disponible en este momento',
      );
    }

    await this.stripeService.refund(payment.stripePaymentIntentId);
    this.logger.log(
      `Reembolso Stripe emitido para el intent ${payment.stripePaymentIntentId}`,
    );
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
