export enum AppointmentStatus {
  PENDIENTE = 'pendiente',
  CONFIRMADA = 'confirmada',
  COMPLETADA = 'completada',
  CANCELADA = 'cancelada',
  NO_ASISTIO = 'no_asistio',
}

export enum CancelledBy {
  CLIENT = 'client',
  BARBER = 'barber',
  SYSTEM = 'system',
}

export enum RecurringType {
  SEMANAL = 'semanal',
  QUINCENAL = 'quincenal',
  MENSUAL = 'mensual',
}
