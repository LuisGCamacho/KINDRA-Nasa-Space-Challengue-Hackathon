"use client";

import { levelOf } from "@/lib/levels";
import type { Level } from "@/lib/types";
import { useSettingsStore } from "@/store/useSettingsStore";

/**
 * Nivel de un cociente con los umbrales de Ajustes. La API calcula el nivel con los valores
 * por defecto; la pantalla lo recalcula para respetar lo que eligió la persona.
 * Devuelve `null` si no hay cociente (sin historial): la pantalla muestra "pendiente".
 */
export function useLevel(ratio: number | null): Level | null {
  const high = useSettingsStore((state) => state.high);
  const veryHigh = useSettingsStore((state) => state.veryHigh);
  return ratio === null ? null : levelOf(ratio, high, veryHigh);
}
