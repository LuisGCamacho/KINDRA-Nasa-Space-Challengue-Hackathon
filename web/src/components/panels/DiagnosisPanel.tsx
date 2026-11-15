"use client";

import { useLensStore } from "@/store/useLensStore";
import { useStats } from "@/hooks/queries";
import { useLevel } from "@/hooks/useLevel";
import { monthName, num, ratio } from "@/lib/format";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { PhaseMeter } from "@/components/ui/PhaseMeter";
import { StatRow } from "@/components/ui/StatRow";

/** La respuesta principal: ¿el fuego de este mes es normal para esta época del año? */
export function DiagnosisPanel() {
  const zoneId = useLensStore((state) => state.zoneId);
  const month = useLensStore((state) => state.month);
  const series = useLensStore((state) => state.series);
  const { data: stats, isPending } = useStats(zoneId, month, series);
  const customLevel = useLevel(stats?.ratio ?? null); // umbrales de Ajustes

  if (isPending || !stats) {
    return (
      <GlassPanel id="diagnostico" title="Diagnóstico">
        <p className="text-[12.5px] text-muted">{isPending ? "Calculando…" : "Pendiente."}</p>
      </GlassPanel>
    );
  }

  const level = customLevel ?? stats.level;
  const headline = stats.ratio === null ? "Sin historial para comparar" : `${ratio(stats.ratio)} lo normal`;

  return (
    <GlassPanel id="diagnostico" title="Diagnóstico" meta={<LevelBadge level={level} compact />}>
      <p className="text-[34px] font-medium leading-none tracking-[-0.03em] tabular-nums">{headline}</p>
      <p className="mt-1.5 text-[12.5px] text-muted">para {monthName(month)}, contra la mediana de años anteriores</p>

      <div className="my-5">
        <PhaseMeter level={level} />
      </div>

      <dl>
        <StatRow label="Este mes" hint="celdas-día" value={num(stats.current)} />
        <StatRow label="Mediana" hint="celdas-día" value={stats.median === null ? "pendiente" : num(stats.median)} />
        <StatRow
          label="Más que"
          value={stats.percentile === null ? "pendiente" : `${num(stats.percentile)} % de los años`}
        />
        <StatRow label="Años comparados" value={num(stats.history.length)} />
      </dl>
    </GlassPanel>
  );
}
