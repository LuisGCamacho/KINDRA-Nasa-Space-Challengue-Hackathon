"use client";

import dynamic from "next/dynamic";
import type { LensMode } from "@/store/useLensStore";
import { MapLensView } from "./views/MapLensView";
import { CameraLensView } from "./views/CameraLensView";

export interface HoverInfo {
  title: string;
  detail: string;
}

/** El 3D (MapLibre con relieve) necesita el navegador: se carga solo en el cliente y solo si se usa. */
const TerrainLensView = dynamic(() => import("./views/TerrainLensView"), {
  ssr: false,
  loading: () => <p className="grid size-full place-items-center text-muted">Cargando terreno 3D…</p>,
});

/** Lo que se ve dentro de la lente según el modo elegido. */
export function LensViewport({ mode, onHover }: { mode: LensMode; onHover: (info: HoverInfo | null) => void }) {
  if (mode === "terreno") return <TerrainLensView />;
  if (mode === "camara") return <CameraLensView />;
  return <MapLensView onHover={onHover} />;
}
