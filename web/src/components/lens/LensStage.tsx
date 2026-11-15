"use client";

import { useState } from "react";
import { Box, Camera, Map as MapIcon } from "lucide-react";
import { useLensStore, type LensMode } from "@/store/useLensStore";
import { useStats } from "@/hooks/queries";
import { LEVEL_COLOR, NO_DATA_COLOR } from "@/lib/colors";
import { Segmented, type SegmentOption } from "@/components/ui/Segmented";
import { LensFrame } from "./LensFrame";
import { LensViewport, type HoverInfo } from "./LensViewport";
import { LensLegend } from "./LensLegend";

const LENS_OPTIONS: SegmentOption<LensMode>[] = [
  { value: "mapa", label: "Mapa", icon: <MapIcon aria-hidden className="size-3.5" /> },
  { value: "terreno", label: "Terreno 3D", icon: <Box aria-hidden className="size-3.5" /> },
  { value: "camara", label: "Cámara", icon: <Camera aria-hidden className="size-3.5" /> },
];

const LENS_HINT: Record<LensMode, string> = {
  mapa: "Toca un punto o un sector dentro de la lupa.",
  terreno: "Arrastra para rotar · rueda para acercar.",
  camara: "Fotograma en vivo de una cámara pública, con la zona anómala marcada.",
};

/** Centro de la pantalla: selector de lente, la lente y la leyenda. */
export function LensStage() {
  const zoneId = useLensStore((state) => state.zoneId);
  const month = useLensStore((state) => state.month);
  const series = useLensStore((state) => state.series);
  const mode = useLensStore((state) => state.mode);
  const setMode = useLensStore((state) => state.setMode);
  const { data: stats } = useStats(zoneId, month, series);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const levelColor = stats ? LEVEL_COLOR[stats.level] : NO_DATA_COLOR;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Segmented label="Lente" value={mode} options={LENS_OPTIONS} onChange={setMode} />
      <LensFrame color={levelColor}>
        <LensViewport mode={mode} onHover={setHover} />
      </LensFrame>
      <p role="status" className="min-h-5 text-center text-[12.5px] tabular-nums text-muted">
        {hover ? <span className="text-heading">{hover.title} · {hover.detail}</span> : LENS_HINT[mode]}
      </p>
      <LensLegend />
    </div>
  );
}
