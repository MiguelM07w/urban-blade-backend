import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Appointment,
  AppointmentDocument,
} from '../appointments/schemas/appointment.schema';
import { AppointmentStatus } from '../appointments/enums/appointment.enums';
import { Ticket, TicketDocument } from '../tickets/schemas/ticket.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Barber, BarberDocument } from '../barbers/schemas/barber.schema';
import { ReportPeriod } from './dto/report-query.dto';

/**
 * Formato de agrupación de fechas por periodo, para $dateToString de Mongo.
 * - daily:   YYYY-MM-DD
 * - weekly:  YYYY-Www (año-semana ISO)
 * - monthly: YYYY-MM
 */
const PERIOD_FORMAT: Record<ReportPeriod, string> = {
  [ReportPeriod.DAILY]: '%Y-%m-%d',
  [ReportPeriod.WEEKLY]: '%Y-W%V',
  [ReportPeriod.MONTHLY]: '%Y-%m',
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<TicketDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Barber.name)
    private readonly barberModel: Model<BarberDocument>,
  ) {}

  /**
   * Ingresos agrupados por periodo, a partir de los tickets generados.
   */
  async income(
    period: ReportPeriod,
  ): Promise<Array<{ period: string; total: number; count: number }>> {
    const format = PERIOD_FORMAT[period];
    const result = await this.ticketModel
      .aggregate<{ _id: string; total: number; count: number }>([
        {
          $group: {
            _id: { $dateToString: { format, date: '$serviceDate' } },
            total: { $sum: '$price' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();
    return result.map((r) => ({
      period: r._id,
      total: r.total,
      count: r.count,
    }));
  }

  /**
   * Citas completadas vs canceladas agrupadas por periodo.
   */
  async appointments(
    period: ReportPeriod,
  ): Promise<
    Array<{
      period: string;
      completadas: number;
      canceladas: number;
      total: number;
    }>
  > {
    const format = PERIOD_FORMAT[period];
    const result = await this.appointmentModel
      .aggregate<{
        _id: string;
        completadas: number;
        canceladas: number;
        total: number;
      }>([
        {
          $group: {
            _id: { $dateToString: { format, date: '$date' } },
            completadas: {
              $sum: {
                $cond: [
                  { $eq: ['$status', AppointmentStatus.COMPLETADA] },
                  1,
                  0,
                ],
              },
            },
            canceladas: {
              $sum: {
                $cond: [
                  { $eq: ['$status', AppointmentStatus.CANCELADA] },
                  1,
                  0,
                ],
              },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();
    return result.map((r) => ({
      period: r._id,
      completadas: r.completadas,
      canceladas: r.canceladas,
      total: r.total,
    }));
  }

  /**
   * Clientes nuevos vs recurrentes. Un cliente es "recurrente" si tiene más de
   * una cita completada; "nuevo" si tiene exactamente una.
   */
  async clients(): Promise<{ nuevos: number; recurrentes: number }> {
    const grouped = await this.appointmentModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: AppointmentStatus.COMPLETADA } },
        { $group: { _id: '$client', count: { $sum: 1 } } },
      ])
      .exec();

    let nuevos = 0;
    let recurrentes = 0;
    for (const g of grouped) {
      if (g.count > 1) {
        recurrentes += 1;
      } else {
        nuevos += 1;
      }
    }
    return { nuevos, recurrentes };
  }

  /**
   * Ranking de barberos por calificación y número de citas completadas.
   */
  async barbers(): Promise<
    Array<{ barber: string; rating: number; completadas: number }>
  > {
    // Rating viene del propio documento del barbero; las citas completadas se
    // cuentan desde appointments.
    const completedByBarber = await this.appointmentModel
      .aggregate<{ _id: string; completadas: number }>([
        { $match: { status: AppointmentStatus.COMPLETADA } },
        { $group: { _id: '$barber', completadas: { $sum: 1 } } },
      ])
      .exec();

    const completedMap = new Map(
      completedByBarber.map((c) => [c._id.toString(), c.completadas]),
    );

    const barbers = await this.barberModel
      .find({ isActive: true })
      .select('rating')
      .lean()
      .exec();

    return barbers
      .map((b) => ({
        barber: b._id.toString(),
        rating: b.rating,
        completadas: completedMap.get(b._id.toString()) ?? 0,
      }))
      .sort(
        (a, b) => b.rating - a.rating || b.completadas - a.completadas,
      );
  }

  /**
   * Horarios más concurridos, contando citas por hora de inicio (HH:mm).
   */
  async peakHours(): Promise<Array<{ hour: string; count: number }>> {
    const result = await this.appointmentModel
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$startTime', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .exec();
    return result.map((r) => ({ hour: r._id, count: r.count }));
  }

  /**
   * Servicio más popular, contando tickets por servicio.
   */
  async services(): Promise<
    Array<{ service: string; count: number }>
  > {
    const result = await this.ticketModel
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$service', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .exec();
    return result.map((r) => ({
      service: r._id ? r._id.toString() : 'desconocido',
      count: r.count,
    }));
  }
}
