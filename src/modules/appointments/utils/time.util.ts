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
 * Combina una fecha (día) con una hora HH:mm en un Date local.
 *
 * La parte de FECHA se lee en componentes UTC (año/mes/día), porque una fecha
 * "date-only" como "2026-07-25" llega parseada a medianoche UTC; leerla en local
 * la correría al día anterior en zonas con offset negativo. La HORA (HH:mm) se
 * aplica en hora local del servidor: el resultado es "ese día a esa hora local".
 */
export function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10));
  const d = new Date(date);
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    h,
    m,
    0,
    0,
  );
}

/**
 * Rango [inicio, fin) del día para una fecha dada, en hora local del servidor.
 * La parte de fecha se lee en componentes UTC (ver `combineDateAndTime`) para no
 * correr el día en zonas con offset negativo.
 */
export function dayRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const start = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Día de la semana (0=domingo … 6=sábado) de una fecha, leído en componentes
 * UTC. Una fecha "date-only" llega a medianoche UTC; usar getDay() local la
 * correría al día anterior en offsets negativos. Usar SIEMPRE este helper para
 * derivar el día de la semana de la fecha de una cita.
 */
export function dayOfWeekUTC(date: Date): number {
  return new Date(date).getUTCDay();
}

/**
 * Indica si una fecha date-only del cliente (`clientDate`, leída en UTC)
 * corresponde a HOY en la hora del servidor. Compara el día calendario de la
 * cita (componentes UTC) con el día calendario actual del servidor (locales).
 */
export function isTodayServer(clientDate: Date): boolean {
  const d = new Date(clientDate);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getFullYear() &&
    d.getUTCMonth() === now.getMonth() &&
    d.getUTCDate() === now.getDate()
  );
}

/**
 * Rango [inicio, fin) de CALENDARIO que contiene el día de hoy, en medianoche
 * UTC (que es como se almacenan las fechas de las citas: `date` date-only).
 *
 * - `day`   → hoy 00:00Z hasta mañana 00:00Z.
 * - `week`  → lunes 00:00Z de esta semana hasta el lunes siguiente (7 días).
 * - `month` → día 1 00:00Z del mes hasta el día 1 del mes siguiente.
 *
 * Incluye los días YA PASADOS del periodo (para métricas: ingresos del mes/semana
 * completo, no solo desde hoy). Usa componentes UTC para casar con `date` de las
 * citas y no correr el día en zonas con offset.
 */
export function calendarRange(period: 'day' | 'week' | 'month'): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  if (period === 'day') {
    const start = new Date(Date.UTC(y, m, d));
    const end = new Date(Date.UTC(y, m, d + 1));
    return { start, end };
  }

  if (period === 'week') {
    // Semana lunes–domingo que contiene hoy. getUTCDay(): 0=domingo … 6=sábado.
    const dow = (now.getUTCDay() + 6) % 7; // 0 = lunes
    const start = new Date(Date.UTC(y, m, d - dow));
    const end = new Date(Date.UTC(y, m, d - dow + 7));
    return { start, end };
  }

  // month: mes calendario completo.
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 1));
  return { start, end };
}
