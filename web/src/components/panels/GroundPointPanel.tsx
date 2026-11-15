"use client";

import { useLensStore } from "@/store/useLensStore";
import { num } from "@/lib/format";
import { googleMapsUrl } from "@/lib/geo";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatRow } from "@/components/ui/StatRow";

/** Detalle de la celda que se tocó en el mapa. */
export function GroundPointPanel() {
  const cell = useLensStore((state) => state.selectedCell);

  if (!cell) {
    return (
      <GlassPanel id="punto" title="Punto en el suelo">
        <p className="text-[12.5px] text-muted">Toca una celda del mapa para ver su detalle.</p>
      </GlassPanel>
    );
  }

  const [lat, lon, cellDays, frpMax] = cell;

  return (
    <GlassPanel id="punto" title="Punto en el suelo" meta={`${num(lat, 2)}, ${num(lon, 2)}`}>
      <dl>
        <StatRow label="Días con fuego" hint="este mes" value={num(cellDays)} />
        <StatRow label="Potencia máxima" hint="FRP" value={`${num(frpMax)} MW`} />
      </dl>
      <a
        href={googleMapsUrl([lon, lat])}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block text-[12.5px] underline underline-offset-2"
      >
        Abrir en Google Maps
      </a>
    </GlassPanel>
  );
}
