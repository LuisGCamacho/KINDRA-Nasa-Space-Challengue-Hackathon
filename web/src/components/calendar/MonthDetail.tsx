"use client";

import type { MonthRow, YearMonth } from "@/lib/types";
import type { SeriesMode } from "@/store/useLensStore";
import type { CompareResult } from "@/server/stats";
import { monthLabel, num } from "@/lib/format";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { PillButton } from "@/components/ui/PillButton";
import { StatRow } from "@/components/ui/StatRow";
import { diagnosisHeadline, formatMedian } from "@/components/panels/DiagnosisPanel";

/** Nombre para la pantalla del satélite de referencia que escribe Python en `src`. */
const SATELLITE_NAME: Record<string, string> = {
  MODIS_TERRA: "MODIS Terra",
  MODIS_AQUA: "MODIS Aqua",
  VIIRS_SNPP: "VIIRS Suomi NPP",
  VIIRS_NOAA20: "VIIRS NOAA-20",
};

/** Por qué un mes no tiene comparación, en palabras del usuario. */
const NO_COMPARISON: Record<Exclude<CompareResult, { ok: true }>["reason"], string> = {
  sin_periodo: "Fuera de la serie",
  sin_dato: "Sin dato en esta serie",
  sin_historial: "Sin historial para comparar",
};

interface MonthDetailProps {
  month: YearMonth | null;
  row: MonthRow | null;
  result: CompareResult | undefined;
  series: SeriesMode;
  onOpen: (month: YearMonth) => void;
}

/**
 * Lo esencial de un mes del calendario: cuánto fuego hubo, contra qué se compara, con qué
 * satélite y si el dato ya es definitivo. Muestra el mes bajo el cursor o, si no hay, el elegido.
 */
export function MonthDetail({ month, row, result, series, onOpen }: MonthDetailProps) {
  if (!month || !row) {
    return (
      <GlassPanel id="mes-calendario" title="Mes">
        <p className="text-[12.5px] text-muted">
          {month ? `${monthLabel(month)}: sin datos.` : "Pasa el cursor o toca un mes para ver su detalle."}
        </p>
      </GlassPanel>
    );
  }

  const stats = result?.ok ? result.stats : null;
  const value = row[series];

  return (
    <GlassPanel
      id="mes-calendario"
      title={monthLabel(month)}
      meta={stats ? <LevelBadge level={stats.level} compact /> : undefined}
    >
      <p className="text-[26px] font-medium leading-tight tracking-[-0.02em] tabular-nums">
        {stats ? diagnosisHeadline(stats) : NO_COMPARISON[result && !result.ok ? result.reason : "sin_historial"]}
      </p>
      <p className="mt-1 text-[12.5px] text-muted">contra la mediana del mismo mes en los años anteriores</p>

      <dl className="mt-4">
        <StatRow label="Este mes" hint="celdas-día" value={thisMonth(value, row, series)} />
        <StatRow label="Mediana" hint="celdas-día" value={stats?.median != null ? formatMedian(stats.median) : "pendiente"} />
        <StatRow
          label="Más que"
          value={stats?.percentile != null ? `${num(stats.percentile)} % de los años` : "pendiente"}
        />
        <StatRow label="MODIS" hint="celdas-día" value={row.modis === null ? "sin dato" : num(row.modis)} />
        <StatRow label="VIIRS" hint="celdas-día" value={row.viirs === null ? "sin dato (antes de 2012)" : num(row.viirs)} />
        <StatRow label="Satélite de referencia" value={SATELLITE_NAME[row.src] ?? row.src} />
        <StatRow label="Dato" value={row.partial ? "Provisorio (FIRMS NRT)" : "Definitivo"} />
      </dl>

      <PillButton variant="primary" className="mt-4 w-full" onClick={() => onOpen(month)}>
        Ver en la lupa
      </PillButton>
    </GlassPanel>
  );
}

/** Valor del mes; en la serie armonizada, con su intervalo por la incertidumbre del factor k. */
function thisMonth(value: number, row: MonthRow, series: SeriesMode): string {
  if (series !== "harm" || (row.lo === row.hi && row.lo === value)) return num(value);
  return `${num(value)} (${num(row.lo)} a ${num(row.hi)})`;
}
