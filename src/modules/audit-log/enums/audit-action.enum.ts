/**
 * Acciones sensibles que se registran en el log de auditoría. Cada valor
 * identifica un tipo de operación relevante para seguridad/trazabilidad.
 */
export enum AuditAction {
  // Autenticación
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  PASSWORD_RESET = 'password_reset',

  // Gestión de usuarios (admin)
  USER_CREATED = 'user_created',
  USER_ROLE_CHANGED = 'user_role_changed',
  USER_BLOCKED = 'user_blocked',
  USER_UNBLOCKED = 'user_unblocked',
  USER_DELETED = 'user_deleted',

  // Citas
  APPOINTMENT_CANCELLED = 'appointment_cancelled',
  APPOINTMENT_STATUS_CHANGED = 'appointment_status_changed',

  // Catálogo / precios
  SERVICE_UPDATED = 'service_updated',
  PROMOTION_CREATED = 'promotion_created',
  COUPON_CREATED = 'coupon_created',

  // Fidelización / trust score
  TRUST_SCORE_RESTORED = 'trust_score_restored',
}

/**
 * Resultado de la acción auditada.
 */
export enum AuditOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
}
