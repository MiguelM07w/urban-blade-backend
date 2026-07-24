/**
 * Estados de una entrada en la lista de espera.
 * - esperando:  a la espera de que se libere un cupo.
 * - notificado: se le avisó de un cupo libre; tiene una ventana para reservar.
 * - reservado:  concretó la reserva del cupo.
 * - expirado:   no reservó a tiempo y perdió la prioridad.
 */
export enum WaitingListStatus {
  ESPERANDO = 'esperando',
  NOTIFICADO = 'notificado',
  RESERVADO = 'reservado',
  EXPIRADO = 'expirado',
}
