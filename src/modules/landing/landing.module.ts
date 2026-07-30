import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { LandingController } from './landing.controller';

/**
 * Páginas HTML públicas de bienvenida y estado (GET /api y GET /api/status).
 * No afecta a GET /api/health (que sigue sirviendo el JSON de Terminus).
 */
@Module({
  imports: [TerminusModule],
  controllers: [LandingController],
})
export class LandingModule {}
