"use client";

import { useRouter } from "next/navigation";
import type { Camera, Detection } from "@/lib/alert-types";
import { useLatestDetection } from "@/hooks/queries";
import { useFreshImageUrl } from "@/hooks/useFreshImageUrl";
import { useLensStore } from "@/store/useLensStore";
import { FIRE_LABEL_NAME, formatConfidence } from "@/lib/detection-text";
import { formatLocalTime } from "@/lib/time";

/**
 * Miniatura de una cámara: su foto más reciente, renovada cada `refreshSeconds`. Al tocarla, la
 * lupa se abre en modo Cámara, donde se ve el video en vivo si la cámara lo tiene.
 *
 * Los recuadros no se dibujan aquí: la foto ya es más nueva que la que analizó el agente y no
 * coincidirían. La captura con sus recuadros está en la lupa.
 */
export function CameraCard({ camera }: { camera: Camera }) {
  const router = useRouter();
  const setCamera = useLensStore((state) => state.setCamera);
  const setMode = useLensStore((state) => state.setMode);
  const { data: detection } = useLatestDetection(camera.id);
  const imageUrl = useFreshImageUrl(camera.imageUrl, camera.refreshSeconds);

  const open = () => {
    setCamera(camera.id);
    setMode("camara");
    router.push("/explorar");
  };

  return (
    <button type="button" onClick={open} className="glass block w-full overflow-hidden rounded-[22px] text-left">
      <div className="relative aspect-video bg-base">
        {/* eslint-disable-next-line @next/next/no-img-element -- la URL cambia en cada renovación */}
        <img src={imageUrl} alt="" loading="lazy" className="size-full object-cover" />
        {camera.videoUrl && camera.provider !== "demo" && (
          <span className="absolute left-3 top-3 rounded-full bg-base/80 px-2.5 py-0.5 text-[11px]">Video en vivo</span>
        )}
      </div>
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="truncate text-[13px] font-medium">{camera.name}</span>
        <span className="ml-auto whitespace-nowrap text-[12px] tabular-nums text-muted">{detectionText(detection)}</span>
      </div>
      <p className="px-4 pb-3 text-[11px] text-muted">{camera.attribution}</p>
    </button>
  );
}

/** "Humo 82 % · captura 14/11/2026, 09:32", o "Sin detección" si el agente no vio nada. */
function detectionText(detection: Detection | null | undefined): string {
  const top = detection?.regions.toSorted((a, b) => b.confidence - a.confidence)[0];
  if (!detection || !top) return "Sin detección";
  return `${FIRE_LABEL_NAME[top.label]} ${formatConfidence(top.confidence)} · captura ${formatLocalTime(detection.capturedAt)}`;
}
