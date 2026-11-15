"use client";

import { useLensStore } from "@/store/useLensStore";
import { TargetPanel } from "@/components/panels/TargetPanel";
import { MapOptionsPanel } from "@/components/panels/MapOptionsPanel";
import { TerrainOptionsPanel } from "@/components/panels/TerrainOptionsPanel";
import { CameraPanel } from "@/components/panels/CameraPanel";
import { WeatherPanel } from "@/components/panels/WeatherPanel";

/** Paneles de la izquierda: el objetivo siempre, y las opciones de la lente activa. */
export function LeftPanels() {
  const mode = useLensStore((state) => state.mode);
  return (
    <>
      <TargetPanel />
      {mode === "mapa" && <MapOptionsPanel />}
      {mode === "terreno" && <TerrainOptionsPanel />}
      {mode === "camara" && (
        <>
          <CameraPanel />
          <WeatherPanel />
        </>
      )}
    </>
  );
}
