export enum TrustScoreAction {
  NO_ASISTIO = 'no_asistio',
  CANCELACION_TARDIA = 'cancelacion_tardia',
  CANCELACION_NORMAL = 'cancelacion_normal',
  CITA_COMPLETADA = 'cita_completada',
}

/**
 * Puntos aplicados por cada acción sobre el trust score.
 */
export const TRUST_SCORE_POINTS: Record<TrustScoreAction, number> = {
  [TrustScoreAction.NO_ASISTIO]: -30,
  [TrustScoreAction.CANCELACION_TARDIA]: -10,
  [TrustScoreAction.CANCELACION_NORMAL]: -5,
  [TrustScoreAction.CITA_COMPLETADA]: 5,
};

export const TRUST_SCORE_MIN = 0;
export const TRUST_SCORE_MAX = 100;
export const TRUST_SCORE_DEFAULT = 100;

/** Umbral por debajo del cual el usuario queda restringido. */
export const TRUST_SCORE_RESTRICTION_THRESHOLD = 40;
/** Días de restricción cuando el score cae por debajo del umbral. */
export const TRUST_SCORE_RESTRICTION_DAYS = 15;
/** Strikes que causan bloqueo permanente. */
export const TRUST_SCORE_MAX_STRIKES = 3;
