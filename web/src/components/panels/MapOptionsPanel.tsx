"use client";

import { useLensStore, type MapScope } from "@/store/useLensStore";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Segmented, type SegmentOption } from "@/components/ui/Segmented";

const SCOPE_OPTIONS: SegmentOption<MapScope>[] = [
  { value: "sector", label: "Sector" },
  { value: "pais", label: "País" },
];

/** Opciones de la lente 2D. */
export function MapOptionsPanel() {
  const scope = useLensStore((state) => state.scope);
  const setScope = useLensStore((state) => state.setScope);

  return (
    <GlassPanel id="mapa" title="Mapa" meta="Celdas de 0,1°">
      <Segmented label="Alcance del mapa" value={scope} options={SCOPE_OPTIONS} onChange={setScope} fill />
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
        Cada punto es una celda que tuvo fuego al menos un día del mes. El color usa la misma rampa del calendario.
      </p>
    </GlassPanel>
  );
}
