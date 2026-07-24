import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditAction, AuditOutcome } from './enums/audit-action.enum';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

/**
 * Datos de un evento a registrar en el log de auditoría.
 */
export interface AuditEntry {
  action: AuditAction;
  outcome: AuditOutcome;
  actor?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  method?: string;
  path?: string;
  ip?: string;
  targetId?: string | null;
  statusCode?: number;
  detail?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  /**
   * Registra un evento de auditoría. Best-effort: nunca lanza (un fallo al
   * auditar no debe romper la operación de negocio que lo originó).
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditModel.create({
        action: entry.action,
        outcome: entry.outcome,
        actor:
          entry.actor && Types.ObjectId.isValid(entry.actor)
            ? new Types.ObjectId(entry.actor)
            : null,
        actorEmail: entry.actorEmail ?? null,
        actorRole: entry.actorRole ?? null,
        method: entry.method ?? '',
        path: entry.path ?? '',
        ip: entry.ip ?? '',
        targetId: entry.targetId ?? null,
        statusCode: entry.statusCode ?? 0,
        detail: entry.detail ?? '',
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar el evento de auditoría: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Lista los registros de auditoría (admin), paginado y con filtros opcionales
   * por acción y por actor.
   */
  async findAll(params: {
    page: number;
    limit: number;
    action?: AuditAction;
    actor?: string;
  }): Promise<{
    items: AuditLogDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, action, actor } = params;
    const filter: Record<string, unknown> = {};
    if (action) {
      filter.action = action;
    }
    if (actor && Types.ObjectId.isValid(actor)) {
      filter.actor = new Types.ObjectId(actor);
    }

    const [items, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }
}
