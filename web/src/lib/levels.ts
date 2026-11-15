import type { Level } from "./types";

/** Umbrales por defecto del cociente contra la mediana. Se pueden cambiar en Ajustes. */
export const DEFAULT_HIGH = 1.5;
export const DEFAULT_VERY_HIGH = 3;

/**
 * Celdas-día mínimas para que un período pueda ser "Alto" o "Muy alto".
 * Con menos, el nivel no pasa de "Normal" aunque el cociente sea alto: en zonas chicas la
 * mediana suele ser de 1 a 3 celdas-día, y 3 contra 1 ya daría "Muy alto" sin fuego real.
 * El cociente se informa igual. Python aplica la misma regla.
 */
export const MIN_CELL_DAYS_FOR_HIGH = 10;

/**
 * Clasifica el cociente del mes contra la mediana del mismo mes en años anteriores.
 * El límite inferior de Normal es siempre `1 / high` (con los valores por defecto,
 * 1 / 1,5 ≈ 0,67). La misma regla se usa en Python, en la API y en la pantalla.
 *
 * @param ratio - Cociente `actual / mediana`.
 * @param high - Umbral de "Alto"; se espera mayor que 1.
 * @param veryHigh - Umbral de "Muy alto"; se espera mayor que `high`.
 */
export function levelOf(ratio: number, high = DEFAULT_HIGH, veryHigh = DEFAULT_VERY_HIGH): Level {
  if (ratio >= veryHigh) return "Muy alto";
  if (ratio >= high) return "Alto";
  if (ratio >= 1 / high) return "Normal";
  return "Bajo";
}

/**
 * Nivel de un período con todas las reglas: el cociente y el mínimo de celdas-día.
 * Es el que usan la API (`server/stats.ts`) y la pantalla: con umbrales propios de Ajustes,
 * la pantalla tiene que llamar a esta función y no a `levelOf`, o pierde la regla del mínimo.
 *
 * - Sin mediana para dividir (`ratio` en `null`): si no hubo fuego es Normal; si hubo,
 *   el cociente es infinito.
 * - Con menos de `MIN_CELL_DAYS_FOR_HIGH` celdas-día no pasa de Normal.
 *
 * @param current - Celdas-día del período (`Stats.current`).
 * @param ratio - `Stats.ratio`: cociente contra la mediana, o `null` si la mediana es 0.
 */
export function levelForPeriod(
  current: number,
  ratio: number | null,
  high = DEFAULT_HIGH,
  veryHigh = DEFAULT_VERY_HIGH,
): Level {
  if (ratio === null && current === 0) return "Normal";
  const level = levelOf(ratio ?? Infinity, high, veryHigh);
  const isHigh = level === "Alto" || level === "Muy alto";
  return isHigh && current < MIN_CELL_DAYS_FOR_HIGH ? "Normal" : level;
}

/** `true` si el nivel pide atención: "Alto" o "Muy alto". */
export function isAlertLevel(level: Level): boolean {
  return level === "Alto" || level === "Muy alto";
}
