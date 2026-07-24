/**
 * Utilidades de manejo de horas en formato HH:mm.
 */

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

/**
 * Combina una fecha (día) con una hora HH:mm en un Date.
 */
export function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  const result = new Date(date);
  result.setHours(h, m, 0, 0);
  return result;
}

/**
 * Rango [inicio, fin) del día para una fecha dada.
 */
export function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
