"use client";

import { useRef } from "react";
import { useCameras, useLatestDetection, useTrack } from "@/hooks/queries";
import { useLensStore } from "@/store/useLensStore";
import { useVideoRegions } from "@/hooks/useVideoRegions";
import { DetectionOverlay } from "@/components/camera/DetectionOverlay";

/**
 * Lente de cámara: la foto (o el video de la demo) con las zonas anómalas marcadas.
 * En foto se dibuja la última detección; en video, los recuadros siguen al humo cuadro a cuadro.
 */
export function CameraLensView() {
  const cameraId = useLensStore((state) => state.cameraId);
  const { data: cameras } = useCameras();
  const { data: detection } = useLatestDetection(cameraId);
  const { data: track } = useTrack(cameraId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRegions = useVideoRegions(videoRef, track ?? []);

  const camera = cameras?.find((item) => item.id === cameraId);
  if (!camera) return <p className="grid size-full place-items-center text-muted">Elige una cámara.</p>;

  const regions = camera.videoUrl ? videoRegions : (detection?.regions ?? []);
  const materials = detection?.materials ?? [];

  return (
    <figure className="relative size-full">
      {camera.videoUrl ? (
        <video ref={videoRef} src={camera.videoUrl} autoPlay muted loop playsInline className="size-full object-cover" />
      ) : (
        // La URL cambia en cada carga (Windy la vence a los minutos), así que no conviene next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={camera.imageUrl} alt={`Última imagen de ${camera.name}`} className="size-full object-cover" />
      )}
      <DetectionOverlay regions={regions} materials={materials} />
      <figcaption className="absolute inset-x-0 bottom-[9%] text-center text-[11px] text-muted">
        {camera.attribution}
      </figcaption>
    </figure>
  );
}
