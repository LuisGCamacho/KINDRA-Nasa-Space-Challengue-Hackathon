"use client";

import { useLensStore, type SeriesMode } from "@/store/useLensStore";
import { useZones } from "@/hooks/queries";
import { isYearMonth } from "@/lib/period";
import { monthLabel } from "@/lib/format";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PillSelect } from "@/components/ui/PillSelect";
import { Segmented, type SegmentOption } from "@/components/ui/Segmented";
import { FieldLabel } from "@/components/ui/FieldLabel";

const SERIES_OPTIONS: SegmentOption<SeriesMode>[] = [
  { value: "harm", label: "Armonizada" },
  { value: "raw", label: "Cruda" },
];

/** Qué mira la lupa: zona, mes y serie. Cada cambio queda en el historial del botón Return. */
export function TargetPanel() {
  const { zoneId, month, series, setZone, setMonth, setSeries } = useLensStore();
  const { data: zones = [] } = useZones();

  return (
    <GlassPanel id="objetivo" title="Objetivo" meta={monthLabel(month)}>
      <div className="flex flex-col gap-4">
        <div>
          <FieldLabel htmlFor="zona">Zona</FieldLabel>
          <PillSelect id="zona" value={zoneId} onChange={(event) => setZone(event.target.value)}>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </PillSelect>
        </div>

        <div>
          <FieldLabel htmlFor="mes">Mes</FieldLabel>
          <input
            id="mes"
            type="month"
            min="2001-01"
            value={month}
            onChange={(event) => isYearMonth(event.target.value) && setMonth(event.target.value)}
            className="glass h-9 w-full rounded-full px-4 text-[13px] tabular-nums"
          />
        </div>

        <div>
          <FieldLabel>Serie</FieldLabel>
          <Segmented label="Serie" value={series} options={SERIES_OPTIONS} onChange={setSeries} fill />
        </div>
      </div>
    </GlassPanel>
  );
}
