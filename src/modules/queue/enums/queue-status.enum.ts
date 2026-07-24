/**
 * Estados de una entrada en la fila virtual (walk-in).
 * - esperando:  en la fila, aguardando turno.
 * - llamado:    el barbero lo llamó (es su turno / está siendo atendido).
 * - atendido:   completó su atención; sale de la fila.
 * - cancelado:  el cliente o el staff lo sacó de la fila.
 * - expirado:   fue llamado pero no se presentó a tiempo.
 */
export enum QueueStatus {
  ESPERANDO = 'esperando',
  LLAMADO = 'llamado',
  ATENDIDO = 'atendido',
  CANCELADO = 'cancelado',
  EXPIRADO = 'expirado',
}
