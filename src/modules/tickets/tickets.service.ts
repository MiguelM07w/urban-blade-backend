import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { PaymentMethod, PaymentStatus } from './enums/ticket.enums';
import { Ticket, TicketDocument } from './schemas/ticket.schema';

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<TicketDocument>,
  ) {}

  /**
   * Genera un número de ticket único con formato TB-<año>-<secuencia>.
   * La secuencia se calcula contando los tickets del año en curso.
   */
  private async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TB-${year}-`;
    const lastTicket = await this.ticketModel
      .findOne({ ticketNumber: new RegExp(`^${prefix}`) })
      .sort({ ticketNumber: -1 })
      .exec();

    let next = 1;
    if (lastTicket) {
      const lastSeq = parseInt(
        lastTicket.ticketNumber.split('-')[2] ?? '0',
        10,
      );
      next = lastSeq + 1;
    }
    return `${prefix}${next.toString().padStart(4, '0')}`;
  }

  async create(dto: CreateTicketDto): Promise<TicketDocument> {
    const ticketNumber = await this.generateTicketNumber();
    // Si no se envía basePrice, se asume que no hubo descuento (base = price).
    const basePrice = dto.basePrice ?? dto.price;
    const discount = dto.discount ?? 0;
    return this.ticketModel.create({
      ticketNumber,
      appointment: new Types.ObjectId(dto.appointment),
      client: new Types.ObjectId(dto.client),
      barber: new Types.ObjectId(dto.barber),
      service: new Types.ObjectId(dto.service),
      serviceDate: dto.serviceDate,
      completedAt: new Date(),
      basePrice,
      discount,
      price: dto.price,
      paymentMethod: dto.paymentMethod,
      paymentStatus: dto.paymentStatus,
      appliedPromotion: dto.appliedPromotion
        ? {
            promotion: new Types.ObjectId(dto.appliedPromotion.promotion),
            title: dto.appliedPromotion.title,
            type: dto.appliedPromotion.type,
            discountValue: dto.appliedPromotion.discountValue,
            scope: dto.appliedPromotion.scope,
          }
        : null,
      appliedCoupon: dto.appliedCoupon
        ? {
            coupon: new Types.ObjectId(dto.appliedCoupon.coupon),
            code: dto.appliedCoupon.code,
            discountType: dto.appliedCoupon.discountType,
            discountValue: dto.appliedCoupon.discountValue,
            discount: dto.appliedCoupon.discount,
          }
        : null,
      hairstyleSelected: dto.hairstyleSelected
        ? new Types.ObjectId(dto.hairstyleSelected)
        : null,
    });
  }

  async findAll(paymentStatus?: PaymentStatus): Promise<TicketDocument[]> {
    // Filtro opcional por estado de pago: la cola de cobro del admin usa
    // `paymentStatus=pendiente` para ver los tickets aún no cobrados.
    const filter = paymentStatus ? { paymentStatus } : {};
    return this.ticketModel
      .find(filter)
      .populate('service', 'name price')
      .populate('client', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Busca el ticket generado para una cita (si existe). Usado por appointments
   * para cobrar el ticket recién creado al registrar un walk-in.
   */
  async findByAppointment(
    appointmentId: string,
  ): Promise<TicketDocument | null> {
    this.assertValidId(appointmentId, 'appointmentId');
    return this.ticketModel
      .findOne({ appointment: new Types.ObjectId(appointmentId) })
      .exec();
  }

  async findById(id: string): Promise<TicketDocument> {
    this.assertValidId(id);
    const ticket = await this.ticketModel
      .findById(id)
      .populate('service', 'name price')
      .populate('client', 'name email')
      .exec();
    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }
    return ticket;
  }

  async findByClient(clientId: string): Promise<TicketDocument[]> {
    this.assertValidId(clientId, 'clientId');
    return this.ticketModel
      .find({ client: new Types.ObjectId(clientId) })
      .populate('service', 'name price')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Marca el ticket como pagado. Llamado por el módulo de payments al registrar
   * un pago. Si se indica el método de pago (efectivo/tarjeta), lo propaga al
   * ticket para que el recibo refleje cómo se cobró realmente; si se omite, se
   * conserva el método que ya tuviera el ticket.
   */
  async markAsPaid(
    id: string,
    method?: PaymentMethod,
  ): Promise<TicketDocument> {
    this.assertValidId(id);
    const update: {
      paymentStatus: PaymentStatus;
      paymentMethod?: PaymentMethod;
    } = { paymentStatus: PaymentStatus.PAGADO };
    if (method) {
      update.paymentMethod = method;
    }
    const ticket = await this.ticketModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }
    return ticket;
  }

  /**
   * Vuelve a marcar el ticket como pendiente de pago. Llamado por payments al
   * reembolsar un pago (el ticket deja de estar pagado).
   */
  async markAsUnpaid(id: string): Promise<TicketDocument> {
    this.assertValidId(id);
    const ticket = await this.ticketModel
      .findByIdAndUpdate(
        id,
        { paymentStatus: PaymentStatus.PENDIENTE },
        { new: true },
      )
      .exec();
    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }
    return ticket;
  }

  private assertValidId(id: string, field = 'id'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El ${field} proporcionado no es válido`);
    }
  }
}
