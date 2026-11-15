"use client";

import { useZone } from "@/hooks/queries";
import { useLevel } from "@/hooks/useLevel";
import { monthLabel, ratio } from "@/lib/format";
import type { Alert } from "@/lib/types";
import { LevelBadge } from "@/components/ui/LevelBadge";

/** Una zona en alerta: cuánto más que lo normal, desde cuándo y con qué satélite. */
export function ZoneAlertRow({ alert }: { alert: Alert }) {
  const zone = useZone(alert.zone);
  const level = useLevel(alert.ratio);

  return (
    <tr>
      <td className="py-3 pr-4">
        <span className="block">{zone?.name ?? alert.zone}</span>
        {zone?.parent && <span className="text-[12px] text-muted">{zone.parent}</span>}
      </td>
      <td className="py-3 pr-4 tabular-nums">{ratio(alert.ratio)} lo normal</td>
      <td className="py-3 pr-4">{level && <LevelBadge level={level} compact />}</td>
      <td className="py-3 pr-4 text-muted">{monthLabel(alert.since)}</td>
      <td className="py-3 pr-4 font-mono text-[12px] text-muted">{alert.sensor}</td>
    </tr>
  );
}
