import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentsService } from './appointments.service';

/**
 * Tareas programadas del módulo de citas.
 */
@Injectable()
export class AppointmentsCron {
  private readonly logger = new Logger(AppointmentsCron.name);

  constructor(private readonly appointmentsService: AppointmentsService) {}

  /**
   * Cada 30 minutos revisa las citas cuyo confirmationDeadline ya pasó y que
   * no fueron confirmadas por el cliente, y las cancela automáticamente.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async cancelUnconfirmedAppointments(): Promise<void> {
    const cancelled = await this.appointmentsService.autoCancelUnconfirmed();
    if (cancelled.length > 0) {
      // Los clientes afectados ya fueron notificados dentro del service.
      this.logger.log(
        `Cron: ${cancelled.length} citas canceladas por falta de confirmación`,
      );
    }
  }

  /**
   * Cada 15 minutos envía los recordatorios de cita pendientes: uno ~24h antes
   * y otro ~1h antes. Cada recordatorio se manda una sola vez por cita.
   */
  @Cron('0 */15 * * * *') // cada 15 minutos
  async sendAppointmentReminders(): Promise<void> {
    const { sent24h, sent1h } =
      await this.appointmentsService.sendDueReminders();
    if (sent24h + sent1h > 0) {
      this.logger.log(
        `Cron: recordatorios enviados (${sent24h} de 24h, ${sent1h} de 1h)`,
      );
    }
  }
}
