import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { landingPage, statusPage } from './landing.pages';

/**
 * Páginas HTML para humanos (negro y dorado, colores de Urban Blade):
 *  - GET /api        → landing de bienvenida de la API.
 *  - GET /api/status → estado visual del servicio y la base de datos.
 * Usan @Res() para devolver HTML crudo (sin el envoltorio JSON del interceptor).
 * NO tocan GET /api/health (JSON de Terminus que consume Render).
 */
@Controller()
export class LandingController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
  ) {}

  @Get()
  @Public()
  @ApiExcludeEndpoint()
  root(@Res() res: Response): void {
    res.type('html').send(landingPage());
  }

  @Get('status')
  @Public()
  @ApiExcludeEndpoint()
  async status(@Res() res: Response): Promise<void> {
    let dbUp = false;
    try {
      await this.health.check([
        () => this.mongoose.pingCheck('mongodb', { timeout: 3000 }),
      ]);
      dbUp = true;
    } catch {
      dbUp = false;
    }
    res.type('html').send(statusPage(dbUp));
  }
}
