/**
 * Tipo de promoción.
 */
export enum PromotionType {
  DESCUENTO = 'descuento',
  SERVICIO_GRATIS = 'servicio_gratis',
  COMBO = 'combo',
}

/**
 * Público objetivo de la promoción. Determina a quién se le notifica.
 */
export enum TargetAudience {
  TODOS = 'todos',
  NIVEL_ORO = 'nivel_oro',
  NIVEL_PLATINO = 'nivel_platino',
  NUEVOS_CLIENTES = 'nuevos_clientes',
}

/**
 * A qué servicios/situaciones aplica el descuento de la promoción (para el
 * cálculo de precio, no para la notificación).
 * - todos:        cualquier servicio.
 * - categoria:    servicios de una categoría concreta (campo `category`).
 * - servicios:    una lista concreta de servicios (campo `services`).
 * - primera_cita: solo la primera cita del cliente (sin citas completadas previas).
 */
export enum PromotionScope {
  TODOS = 'todos',
  CATEGORIA = 'categoria',
  SERVICIOS = 'servicios',
  PRIMERA_CITA = 'primera_cita',
}
