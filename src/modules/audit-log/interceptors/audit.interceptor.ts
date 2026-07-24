import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';
import { AuditLogService } from '../audit-log.service';
import { AUDIT_ACTION_KEY } from '../decorators/audit.decorator';
import { AuditAction, AuditOutcome } from '../enums/audit-action.enum';

interface HttpError {
  status?: number;
  message?: string;
}

/**
 * Interceptor global que registra en el log de auditoría los endpoints marcados
 * con `@Audit(action)`. Captura tanto el éxito como el error de la petición, con
 * el actor (del token), IP, ruta y resultado. No altera la respuesta.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<AuditAction | undefined>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Solo se audita si el endpoint está marcado con @Audit(...).
    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const user = request.user as AuthenticatedUser | undefined;
    const base = {
      action,
      actor: user?.userId ?? null,
      actorEmail: user?.email ?? null,
      actorRole: user?.role ?? null,
      method: request.method,
      path: request.originalUrl || request.url,
      ip: this.clientIp(request),
      targetId: this.extractTargetId(request),
    };

    return next.handle().pipe(
      tap(() => {
        void this.auditLogService.record({
          ...base,
          outcome: AuditOutcome.SUCCESS,
          statusCode: response.statusCode,
        });
      }),
      catchError((err: unknown) => {
        const httpError = err as HttpError;
        void this.auditLogService.record({
          ...base,
          outcome: AuditOutcome.FAILURE,
          statusCode: httpError?.status ?? 500,
          detail: httpError?.message ?? 'Error',
        });
        return throwError(() => err);
      }),
    );
  }

  private clientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip ?? '';
  }

  /**
   * Toma el `:id` de la ruta si existe (recurso afectado).
   */
  private extractTargetId(request: Request): string | null {
    const params = request.params as Record<string, string> | undefined;
    return params?.id ?? params?.userId ?? null;
  }
}
