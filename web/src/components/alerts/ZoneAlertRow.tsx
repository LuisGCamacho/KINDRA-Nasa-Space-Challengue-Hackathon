"use client";

import { useZone } from "@/hooks/queries";
import { monthLabel, ratio } from "@/lib/format";
import type { Alert } from "@/lib/types";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { NO_FIRE_MOST_YEARS } from "@/components/panels/DiagnosisPanel";

/**
 * Una zona en alerta: cuánto más que lo normal, desde cuándo y con qué satélite. El nivel es el
 * de la API, que ya usa los umbrales de Ajustes y la regla de 10 celdas-día (`useZoneAlerts`).
 */
export function ZoneAlertRow({ alert }: { alert: Alert }) {
  const zone = useZone(alert.zone);

  return (
    <tr>
      <td className="py-3 pr-4">
        <span className="block">{zone?.name ?? alert.zone}</span>
        {zone?.parent && <span className="text-[12px] text-muted">{zone.parent}</span>}
      </td>
      <td className="py-3 pr-4 tabular-nums">
        {alert.ratio === null ? `${NO_FIRE_MOST_YEARS} (mediana 0)` : `${ratio(alert.ratio)} lo normal`}
      </td>
      <td className="py-3 pr-4">
        <LevelBadge level={alert.level} compact />
      </td>
      <td className="py-3 pr-4 text-muted">{monthLabel(alert.since)}</td>
      <td className="py-3 pr-4 font-mono text-[12px] text-muted">{alert.sensor}</td>
    </tr>
  );
}
