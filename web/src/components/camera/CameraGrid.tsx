"use client";

import { useState } from "react";
import { useCameras } from "@/hooks/queries";
import type { Camera } from "@/lib/alert-types";
import { Segmented, type SegmentOption } from "@/components/ui/Segmented";
import { CameraCard } from "./CameraCard";

type Filter = "video" | "todas";

/** Tiene video en vivo de su dueño. El de la demo es un video grabado: no cuenta. */
const hasLiveVideo = (camera: Camera) => camera.videoUrl !== null && camera.provider !== "demo";

/**
 * Cuadrícula de cámaras. Abre en "Con video" porque es lo que se ve en vivo; "Todas" suma las que
 * solo publican una foto cada 5 minutos. En las dos, las de video van primero.
 */
export function CameraGrid() {
  const { data: cameras, isPending } = useCameras();
  const [filter, setFilter] = useState<Filter>("video");
  if (isPending) return <p className="text-[13px] text-muted">Cargando cámaras…</p>;

  const all = cameras ?? [];
  const withVideo = all.filter(hasLiveVideo);
  const visible = filter === "video" ? withVideo : [...withVideo, ...all.filter((camera) => !hasLiveVideo(camera))];
  const options: SegmentOption<Filter>[] = [
    { value: "video", label: `Con video (${withVideo.length})` },
    { value: "todas", label: `Todas (${all.length})` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="self-start">
        <Segmented label="Filtrar cámaras" value={filter} options={options} onChange={setFilter} />
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((camera) => (
          <li key={camera.id}>
            <CameraCard camera={camera} />
          </li>
        ))}
      </ul>
    </div>
  );
}
