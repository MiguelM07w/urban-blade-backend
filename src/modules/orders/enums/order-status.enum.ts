/**
 * Estados de una compra de productos (recoger en el local; no hay envío).
 * - pendiente_pago:    creada, aún sin pagar (compra online con tarjeta antes de pagar).
 * - pagada:            pagada; el stock ya se descontó. Falta prepararla.
 * - lista:             preparada y disponible para recoger en el local.
 * - recogida:          el cliente ya la recogió (flujo terminado).
 * - cancelada:         anulada; si estaba pagada, el stock se devuelve.
 */
export enum OrderStatus {
  PENDIENTE_PAGO = 'pendiente_pago',
  PAGADA = 'pagada',
  LISTA = 'lista',
  RECOGIDA = 'recogida',
  CANCELADA = 'cancelada',
}

/**
 * Origen de la compra.
 * - online:    la hizo el cliente desde la app.
 * - mostrador: venta presencial registrada por el staff.
 */
export enum OrderChannel {
  ONLINE = 'online',
  MOSTRADOR = 'mostrador',
}
