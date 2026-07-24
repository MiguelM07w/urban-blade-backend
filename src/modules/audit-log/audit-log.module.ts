import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';

/**
 * Módulo de auditoría. Global para que AuditLogService pueda inyectarse en
 * cualquier módulo (p. ej. auth, para registrar logins fallidos). Registra el
 * AuditInterceptor de forma global: solo actúa sobre endpoints marcados con
 * `@Audit(...)`.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditLogService],
})
export class AuditLogModule {}
