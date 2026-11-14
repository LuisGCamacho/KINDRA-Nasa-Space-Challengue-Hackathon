import type { Level } from "./types";

/** Umbrales por defecto del cociente contra la mediana. Se pueden cambiar en Ajustes. */
export const DEFAULT_HIGH = 1.5;
export const DEFAULT_VERY_HIGH = 3;

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
