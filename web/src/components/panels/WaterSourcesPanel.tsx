"use client";

import { useWaterSources } from "@/hooks/queries";
import { WATER_COLOR, WATER_NAME } from "@/lib/colors";
import { formatDistance, googleMapsUrl } from "@/lib/geo";
import { GlassPanel } from "@/components/ui/GlassPanel";

/** Fuentes de agua más cercanas al fuego, de OpenStreetMap. Solo aparecen en incendios grandes. */
export function WaterSourcesPanel({ alertId }: { alertId: string }) {
  const { data: sources = [] } = useWaterSources(alertId);
  if (sources.length === 0) return null;

  return (
    <GlassPanel id="agua" title="Agua cerca" meta={`${sources.length} fuentes`}>
      <ul>
        {sources.map((source) => (
          <li key={source.id} className="flex items-center gap-2 border-t border-line-soft py-2.5 first:border-t-0">
            <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: WATER_COLOR }} />
            <a href={googleMapsUrl(source.position)} target="_blank" rel="noreferrer" className="truncate text-[12.5px]">
              {WATER_NAME[source.kind]}
              {source.name && <span className="text-muted"> · {source.name}</span>}
            </a>
            <span className="ml-auto text-[13px] tabular-nums">{formatDistance(source.distanceM)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted">© colaboradores de OpenStreetMap</p>
    </GlassPanel>
  );
}
