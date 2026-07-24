import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../users/users.service';

/**
 * Tareas programadas de mantenimiento de sesiones/autenticación.
 */
@Injectable()
export class AuthCron {
  private readonly logger = new Logger(AuthCron.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * Una vez al día limpia los hashes de refresh tokens ya expirados: pone a null
   * el hashedRefreshToken (y su fecha) de los usuarios cuyo token venció. Es
   * higiene de datos; el token expirado ya no es utilizable de todos modos.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredRefreshTokens(): Promise<void> {
    const cleaned = await this.usersService.cleanupExpiredRefreshTokens();
    if (cleaned > 0) {
      this.logger.log(
        `Cron: ${cleaned} refresh token(s) expirado(s) limpiado(s)`,
      );
    }
  }
}
