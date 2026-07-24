/**
 * Niveles de fidelización según puntos acumulados.
 */
export enum LoyaltyLevel {
  BRONCE = 'bronce',
  PLATA = 'plata',
  ORO = 'oro',
  PLATINO = 'platino',
}

/**
 * Tipo de descuento de un cupón.
 */
export enum DiscountType {
  PORCENTAJE = 'porcentaje',
  MONTO_FIJO = 'monto_fijo',
  SERVICIO_GRATIS = 'servicio_gratis',
}

/**
 * Puntos otorgados por cada acción del usuario.
 */
export const LOYALTY_POINTS = {
  CITA_COMPLETADA: 20,
  PRIMERA_CITA: 50, // bono adicional en la primera cita
  RESENA_COMPLETADA: 10,
  REFERIDO_EXITOSO: 30,
} as const;

/**
 * Cada cuántas visitas se otorga un servicio gratis.
 */
export const VISITS_PER_FREE_SERVICE = 10;

/**
 * Servicios gratis de bono que otorga alcanzar cada nivel, UNA sola vez. Bronce
 * y plata no dan bono (0). El bono se suma a `freeServicesEarned` y el usuario
 * lo canjea cuando quiera. Bronce se omite (es el nivel inicial).
 */
export const LEVEL_FREE_SERVICE_BONUS: Record<LoyaltyLevel, number> = {
  [LoyaltyLevel.BRONCE]: 0,
  [LoyaltyLevel.PLATA]: 0,
  [LoyaltyLevel.ORO]: 1,
  [LoyaltyLevel.PLATINO]: 2,
};

/**
 * Umbrales de puntos (mínimo inclusivo) para cada nivel.
 * Bronce: 0-199 | Plata: 200-499 | Oro: 500-999 | Platino: 1000+
 */
export const LEVEL_THRESHOLDS: ReadonlyArray<{
  level: LoyaltyLevel;
  min: number;
}> = [
  { level: LoyaltyLevel.PLATINO, min: 1000 },
  { level: LoyaltyLevel.ORO, min: 500 },
  { level: LoyaltyLevel.PLATA, min: 200 },
  { level: LoyaltyLevel.BRONCE, min: 0 },
];

/**
 * Calcula el nivel de fidelización correspondiente a una cantidad de puntos.
 */
export function resolveLevel(points: number): LoyaltyLevel {
  const match = LEVEL_THRESHOLDS.find((t) => points >= t.min);
  return match ? match.level : LoyaltyLevel.BRONCE;
}

/**
 * Indica si una cantidad de puntos alcanza (o supera) el umbral de un nivel
 * concreto. Usado para otorgar el beneficio de cada nivel una sola vez.
 */
export function resolveLevelReached(
  points: number,
  level: LoyaltyLevel,
): boolean {
  const threshold = LEVEL_THRESHOLDS.find((t) => t.level === level);
  return threshold ? points >= threshold.min : false;
}
