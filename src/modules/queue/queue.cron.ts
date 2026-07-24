import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueService } from './queue.service';

/**
 * Tareas programadas de la fila virtual.
 */
@Injectable()
export class QueueCron {
  private readonly logger = new Logger(QueueCron.name);

  constructor(private readonly queueService: QueueService) {}

  /**
   * Cada minuto: (1) avisa a los clientes cuya espera bajó a ~10 min, y
   * (2) expira las entradas "llamadas" que no se presentaron a tiempo.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    const sent = await this.queueService.notifySoonEntries();
    if (sent > 0) {
      this.logger.log(`Cron: ${sent} aviso(s) de "turno cercano" enviados`);
    }

    const expired = await this.queueService.expireStaleCalled();
    if (expired > 0) {
      this.logger.log(`Cron: ${expired} entrada(s) de fila expiradas`);
    }
  }
}
