"use client";

import { useRouter } from "next/navigation";
import type { Camera } from "@/lib/alert-types";
import { useLatestDetection } from "@/hooks/queries";
import { useLensStore } from "@/store/useLensStore";
import { FIRE_LABEL_NAME, formatConfidence } from "@/lib/detection-text";
import { DetectionOverlay } from "./DetectionOverlay";

/** Miniatura de una cámara. Al tocarla, la lupa se abre en modo Cámara con esa cámara. */
export function CameraCard({ camera }: { camera: Camera }) {
  const router = useRouter();
  const setCamera = useLensStore((state) => state.setCamera);
  const setMode = useLensStore((state) => state.setMode);
  const { data: detection } = useLatestDetection(camera.id);

  const open = () => {
    setCamera(camera.id);
    setMode("camara");
    router.push("/explorar");
  };

  const top = detection?.regions.toSorted((a, b) => b.confidence - a.confidence)[0];

  return (
    <button type="button" onClick={open} className="glass block w-full overflow-hidden rounded-[22px] text-left">
      <div className="relative aspect-video bg-base">
        {/* eslint-disable-next-line @next/next/no-img-element -- la URL cambia en cada carga */}
        <img src={camera.imageUrl} alt="" className="size-full object-cover" />
        {detection && <DetectionOverlay regions={detection.regions} materials={[]} />}
      </div>
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="truncate text-[13px] font-medium">{camera.name}</span>
        <span className="ml-auto whitespace-nowrap text-[12px] tabular-nums text-muted">
          {top ? `${FIRE_LABEL_NAME[top.label]} ${formatConfidence(top.confidence)}` : "Sin detección"}
        </span>
      </div>
      <p className="px-4 pb-3 text-[11px] text-muted">{camera.attribution}</p>
    </button>
  );
}
