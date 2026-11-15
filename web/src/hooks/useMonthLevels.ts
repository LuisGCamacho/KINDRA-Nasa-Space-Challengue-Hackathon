"use client";

import { useMemo } from "react";
import type { Series, YearMonth } from "@/lib/types";
import type { SeriesMode } from "@/store/useLensStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { comparePeriod, type CompareResult } from "@/server/stats";

/**
 * Comparación de cada mes del calendario contra la mediana del mismo mes en los años anteriores.
 *
 * Usa `comparePeriod`, la misma función que `/api/stats`, con los umbrales de Ajustes: el nivel
 * que muestra el calendario es el mismo que da la lupa para ese mes. Se calcula en el navegador
 * porque la serie ya está cargada y son ~300 meses: pedir uno por uno a la API serían 300 pedidos.
 */
export function useMonthLevels(series: Series | undefined, mode: SeriesMode): Map<YearMonth, CompareResult> {
  const high = useSettingsStore((state) => state.high);
  const veryHigh = useSettingsStore((state) => state.veryHigh);

  return useMemo(() => {
    const results = new Map<YearMonth, CompareResult>();
    if (!series) return results;
    for (const row of series.months) {
      results.set(row.t, comparePeriod(series, { from: row.t, to: row.t }, mode, { high, veryHigh }));
    }
    return results;
  }, [series, mode, high, veryHigh]);
}
