import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
  ) {}

  /**
   * Chequeo de salud del servicio. Verifica la conexión a MongoDB Atlas.
   * Público (sin auth) para poder usarse como keep-alive / monitoreo externo.
   * Devuelve 200 si todo está OK, 503 si algún indicador falla.
   */
  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Estado del servicio y conexión a la base de datos',
  })
  check() {
    return this.health.check([
      // Ping a Mongo con timeout de 3s.
      () => this.mongoose.pingCheck('mongodb', { timeout: 3000 }),
    ]);
  }
}
