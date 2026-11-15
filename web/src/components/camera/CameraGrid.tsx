"use client";

import { useCameras } from "@/hooks/queries";
import { CameraCard } from "./CameraCard";

export function CameraGrid() {
  const { data: cameras, isPending } = useCameras();
  if (isPending) return <p className="text-[13px] text-muted">Cargando cámaras…</p>;

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cameras?.map((camera) => (
        <li key={camera.id}>
          <CameraCard camera={camera} />
        </li>
      ))}
    </ul>
  );
}
