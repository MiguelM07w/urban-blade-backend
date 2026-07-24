/**
 * Métodos de pago soportados: efectivo (registrado por el staff) y tarjeta
 * (Stripe, procesado por la pasarela).
 */
export enum PaymentMethod {
  EFECTIVO = 'efectivo',
  STRIPE = 'stripe',
}

/**
 * Estado del pago. Incluye reembolso para operaciones futuras.
 */
export enum PaymentStatus {
  PENDIENTE = 'pendiente',
  PAGADO = 'pagado',
  REEMBOLSADO = 'reembolsado',
}
