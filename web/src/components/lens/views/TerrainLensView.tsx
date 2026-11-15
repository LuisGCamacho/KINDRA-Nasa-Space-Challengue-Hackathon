"use client";

import { useEffect, useRef, useState } from "react";
import type { Viewer } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useZone } from "@/hooks/queries";
import { useLensStore } from "@/store/useLensStore";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const TILES_URL = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${GOOGLE_KEY}`;

/** Altura de la cámara sobre la zona, en metros, y cuánto mira hacia abajo. */
const VIEW_HEIGHT_M = 9000;
const VIEW_PITCH_DEG = -35;

/**
 * Lente 3D realista: Google Photorealistic 3D Tiles dibujados con CesiumJS.
 * Cesium se importa dentro del efecto, después de decirle dónde están sus archivos
 * estáticos (`public/cesium`), y el visor se destruye al salir de la lente.
 * Los créditos de Google quedan a la vista: los pide la licencia.
 */
export default function TerrainLensView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const zone = useZone(useLensStore((state) => state.zoneId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !zone || !GOOGLE_KEY) return;

    let viewer: Viewer | undefined;
    let cancelled = false;

    const start = async () => {
      window.CESIUM_BASE_URL = "/cesium";
      const Cesium = await import("cesium");
      if (cancelled) return;

      viewer = new Cesium.Viewer(container, {
        globe: false,
        baseLayer: false,
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
      });

      try {
        const tileset = await Cesium.Cesium3DTileset.fromUrl(TILES_URL, { showCreditsOnScreen: true });
        if (cancelled) return;
        viewer.scene.primitives.add(tileset);
      } catch {
        setError("No se pudieron cargar las teselas 3D de Google. Revisa la clave y la cuota.");
        return;
      }

      const [lon, lat] = zone.center;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, VIEW_HEIGHT_M),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(VIEW_PITCH_DEG), roll: 0 },
        duration: 1.5,
      });
    };

    void start();
    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [zone]);

  if (!GOOGLE_KEY) return <TerrainMessage text="Terreno 3D pendiente: falta NEXT_PUBLIC_GOOGLE_MAPS_KEY." />;
  if (error) return <TerrainMessage text={error} />;
  return <div ref={containerRef} className="size-full" />;
}

function TerrainMessage({ text }: { text: string }) {
  return <p className="grid size-full place-items-center px-10 text-center text-muted">{text}</p>;
}
