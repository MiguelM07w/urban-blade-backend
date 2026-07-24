import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { AuditAction } from '../enums/audit-action.enum';

export const AUDIT_ACTION_KEY = 'audit_action';

/**
 * Marca un endpoint para que el AuditInterceptor registre su ejecución en el
 * log de auditoría con la acción indicada. Uso: `@Audit(AuditAction.USER_DELETED)`.
 */
export const Audit = (action: AuditAction): CustomDecorator<string> =>
  SetMetadata(AUDIT_ACTION_KEY, action);
