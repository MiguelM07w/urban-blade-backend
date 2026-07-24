/**
 * Tipos de notificación soportados por la app. Cada valor identifica el
 * origen/propósito de la notificación para que el móvil pueda enrutar o
 * renderizar según el caso.
 */
export enum NotificationType {
  RECORDATORIO_CITA = 'recordatorio_cita',
  CONFIRMACION_RESERVA = 'confirmacion_reserva',
  CANCELACION_CITA = 'cancelacion_cita',
  TICKET_COMPLETADO = 'ticket_completado',
  LISTA_DE_ESPERA = 'lista_de_espera',
  PROMOCION = 'promocion',
  RECORDATORIO_CORTE = 'recordatorio_corte',
  DOBLE_CHECK = 'doble_check',
  ALERTA_TRUST_SCORE = 'alerta_trust_score',
  NUEVO_ESTILO = 'nuevo_estilo',
  NUEVO_MENSAJE = 'nuevo_mensaje',
  // Avisos internos dirigidos al admin (mensaje de contacto, corte completado en
  // la fila, etc.).
  AVISO_ADMIN = 'aviso_admin',
  // Aviso al barbero de que un cliente con app entró a la fila virtual.
  FILA_NUEVO_CLIENTE = 'fila_nuevo_cliente',
}
