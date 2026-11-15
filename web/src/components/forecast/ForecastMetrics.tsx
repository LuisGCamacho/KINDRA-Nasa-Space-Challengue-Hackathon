import { num } from "@/lib/format";
import type { Forecast } from "@/lib/types";
import { StatRow } from "@/components/ui/StatRow";

const asPercent = (value: number | null) => (value === null ? "pendiente" : `${num(value * 100)} %`);

/** Qué tan bien anduvo el modelo con los años de prueba (2024 en adelante). */
export function ForecastMetrics({ metrics }: { metrics: Forecast["metrics"] }) {
  return (
    <dl>
      <StatRow label="Precisión" hint="de las alertas, cuántas tuvieron fuego" value={asPercent(metrics.precision)} />
      <StatRow label="Recall" hint="de los fuegos, cuántos se anticiparon" value={asPercent(metrics.recall)} />
      <StatRow label="AUC" value={metrics.auc === null ? "pendiente" : num(metrics.auc, 2)} />
    </dl>
  );
}
