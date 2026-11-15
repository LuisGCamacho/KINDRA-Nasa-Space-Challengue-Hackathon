"use client";

import { useLensStore } from "@/store/useLensStore";
import { useStats } from "@/hooks/queries";
import { useLevel } from "@/hooks/useLevel";
import { monthName, num, ratio } from "@/lib/format";
import type { Stats } from "@/lib/types";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { PhaseMeter } from "@/components/ui/PhaseMeter";
import { StatRow } from "@/components/ui/StatRow";

/** Texto del caso sin cociente con fuego este mes; el mismo en la tabla de Alertas. */
export const NO_FIRE_MOST_YEARS = "Sin fuego la mayoría de los años";

/** La respuesta principal: ¿el fuego de este mes es normal para esta época del año? */
export function DiagnosisPanel() {
  const zoneId = useLensStore((state) => state.zoneId);
  const month = useLensStore((state) => state.month);
  const series = useLensStore((state) => state.series);
  const { data: stats, isPending } = useStats(zoneId, month, series);
  const level = useLevel(stats?.current ?? 0, stats?.ratio ?? null); // umbrales de Ajustes

  if (isPending || !stats) {
    return (
      <GlassPanel id="diagnostico" title="Diagnóstico">
        <p className="text-[12.5px] text-muted">{isPending ? "Calculando…" : "Pendiente."}</p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel id="diagnostico" title="Diagnóstico" meta={<LevelBadge level={level} compact />}>
      <p className="text-[34px] font-medium leading-none tracking-[-0.03em] tabular-nums">{diagnosisHeadline(stats)}</p>
      <p className="mt-1.5 text-[12.5px] text-muted">{subtitle(stats, monthName(month))}</p>

      <div className="my-5">
        <PhaseMeter level={level} />
      </div>

      <dl>
        <StatRow label="Este mes" hint="celdas-día" value={num(stats.current)} />
        <StatRow label="Mediana" hint="celdas-día" value={stats.median === null ? "pendiente" : formatMedian(stats.median)} />
        <StatRow
          label="Más que"
          value={stats.percentile === null ? "pendiente" : `${num(stats.percentile)} % de los años`}
        />
        <StatRow label="Años comparados" value={num(stats.history.length)} />
      </dl>
    </GlassPanel>
  );
}

/**
 * Cifra grande del panel. Sin cociente hay dos casos distintos: no hay años para comparar, o
 * los hay pero la mediana es 0. Mediana 0 no quiere decir "nunca hubo fuego": quiere decir que
 * la mayoría de los años no tuvo (Alpine, julio de 2021: mediana 0, pero 5 celdas-día en 2002).
 * Usa el mismo texto que la tabla de Alertas; el calendario lo usa también.
 */
export function diagnosisHeadline(stats: Stats): string {
  if (stats.ratio !== null) return `${ratio(stats.ratio)} lo normal`;
  if (stats.median === null) return "Sin historial para comparar";
  return stats.current > 0 ? NO_FIRE_MOST_YEARS : "Sin fuego, como la mayoría de los años";
}

function subtitle(stats: Stats, month: string): string {
  if (stats.ratio === null && stats.median === 0) return `en ${month}: la mediana de años anteriores es 0, no hay cociente`;
  return `para ${month}, contra la mediana de años anteriores`;
}

/**
 * La mediana de valores enteros es entera o termina en ,5: se muestra con un decimal solo
 * cuando lo tiene. Redondearla mentía: 15 contra "2" no da los 10,0× del titular, 15 contra 1,5 sí.
 */
export function formatMedian(value: number): string {
  return Number.isInteger(value) ? num(value) : num(value, 1);
}
