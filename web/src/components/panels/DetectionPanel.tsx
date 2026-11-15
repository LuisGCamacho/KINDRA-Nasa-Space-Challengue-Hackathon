"use client";

import type { ReactNode } from "react";
import { useLensStore } from "@/store/useLensStore";
import { useLatestDetection } from "@/hooks/queries";
import { FIRE_LABEL_COLOR, MATERIAL_COLOR, MATERIAL_NAME } from "@/lib/colors";
import { FIRE_LABEL_NAME, formatConfidence } from "@/lib/detection-text";
import { formatDistance } from "@/lib/geo";
import { formatLocalTime } from "@/lib/time";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatRow } from "@/components/ui/StatRow";

/** Lo que vio el modelo en el último cuadro: zonas anómalas y materiales cerca. */
export function DetectionPanel() {
  const cameraId = useLensStore((state) => state.cameraId);
  const { data: detection } = useLatestDetection(cameraId);

  if (!detection) {
    return (
      <GlassPanel id="deteccion" title="Detección">
        <p className="text-[12.5px] text-muted">Sin humo ni llamas en el último cuadro.</p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel id="deteccion" title="Detección" meta={formatLocalTime(detection.capturedAt)}>
      <dl>
        {detection.regions.map((region, i) => (
          <StatRow
            key={region.trackId ?? i}
            label={FIRE_LABEL_NAME[region.label]}
            value={<Dot color={FIRE_LABEL_COLOR[region.label]}>{formatConfidence(region.confidence)}</Dot>}
          />
        ))}
        {detection.materials.map((material, i) => (
          <StatRow
            key={`material-${i}`}
            label={MATERIAL_NAME[material.label]}
            hint={material.source === "osm" ? "OpenStreetMap" : "en la imagen"}
            value={
              <Dot color={MATERIAL_COLOR}>
                {material.distanceM === null ? "distancia pendiente" : formatDistance(material.distanceM)}
              </Dot>
            }
          />
        ))}
      </dl>
      <p className="mt-3 text-[11.5px] text-muted">
        Modelo {detection.model.name} {detection.model.version}
      </p>
    </GlassPanel>
  );
}

function Dot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </span>
  );
}
