"use client";

import { levelForPeriod } from "@/lib/levels";
import type { Level } from "@/lib/types";
import { useSettingsStore } from "@/store/useSettingsStore";

/**
 * Nivel de un período con los umbrales de Ajustes. La API calcula el nivel con los valores por
 * defecto; la pantalla lo recalcula para respetar lo que eligió la persona.
 *
 * Usa `levelForPeriod` y no `levelOf`: así se mantiene la regla de AGENTS.md (con menos de
 * 10 celdas-día no se pasa de Normal) y el caso sin cociente (mediana 0) se resuelve igual que
 * en la API.
 *
 * @param current - Celdas-día del período (`Stats.current`).
 * @param ratio - `Stats.ratio`: cociente contra la mediana, o `null` si la mediana es 0.
 */
export function useLevel(current: number, ratio: number | null): Level {
  const high = useSettingsStore((state) => state.high);
  const veryHigh = useSettingsStore((state) => state.veryHigh);
  return levelForPeriod(current, ratio, high, veryHigh);
}
