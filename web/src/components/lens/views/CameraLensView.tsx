"use client";

import { useRef, useState } from "react";
import { useCameras, useLatestDetection, useTrack } from "@/hooks/queries";
import { useLensStore } from "@/store/useLensStore";
import { useVideoRegions } from "@/hooks/useVideoRegions";
import { useFreshImageUrl } from "@/hooks/useFreshImageUrl";
import { formatLocalTime } from "@/lib/time";
import type { Camera, Detection } from "@/lib/alert-types";
import { DetectionOverlay } from "@/components/camera/DetectionOverlay";
import { LiveVideo } from "@/components/camera/LiveVideo";
import { Segmented, type SegmentOption } from "@/components/ui/Segmented";

type View = "captura" | "vivo";

const VIEWS: SegmentOption<View>[] = [
  { value: "captura", label: "Captura del agente" },
  { value: "vivo", label: "En vivo" },
];

/**
 * Lente de cámara. Hay tres casos:
 * - **Video de la demo:** los recuadros siguen al humo cuadro a cuadro (`track`).
 * - **Cámara con detección:** la foto que analizó el agente, con sus recuadros y su hora. Se puede
 *   pasar a En vivo, que va sin recuadros: sobre otra imagen ya no coincidirían con el humo.
 * - **Cámara sin detección:** el video en vivo de Caltrans o, si no tiene, su última foto.
 */
export function CameraLensView() {
  const cameraId = useLensStore((state) => state.cameraId);
  const { data: cameras } = useCameras();
  const { data: detection } = useLatestDetection(cameraId);
  const [view, setView] = useState<View>("captura");

  const camera = cameras?.find((item) => item.id === cameraId);
  if (!camera) return <p className="grid size-full place-items-center text-muted">Elige una cámara.</p>;
  if (camera.provider === "demo") return <DemoVideo camera={camera} />;

  const showCapture = detection && view === "captura";
  return (
    <figure className="relative size-full">
      {showCapture ? <AgentCapture camera={camera} detection={detection} /> : <LiveFeed camera={camera} />}
      {detection && (
        <div className="absolute inset-x-0 top-[9%] flex justify-center">
          <Segmented label="Imagen de la cámara" value={view} options={VIEWS} onChange={setView} />
        </div>
      )}
      <figcaption className="absolute inset-x-0 bottom-[9%] text-center text-[11px] text-muted">
        {showCapture && `Captura del agente · ${formatLocalTime(detection.capturedAt)} · `}
        {camera.attribution}
      </figcaption>
    </figure>
  );
}

/** Lo que la cámara muestra ahora: video si Caltrans lo publica, si no la última foto. */
function LiveFeed({ camera }: { camera: Camera }) {
  if (camera.videoUrl) return <LiveVideo src={camera.videoUrl} poster={camera.imageUrl} label={camera.name} />;
  return <FreshPhoto camera={camera} />;
}

/** Foto de una cámara sin video, renovada cada `refreshSeconds` (5 min en Caltrans). */
function FreshPhoto({ camera }: { camera: Camera }) {
  const imageUrl = useFreshImageUrl(camera.imageUrl, camera.refreshSeconds);
  // La URL cambia en cada renovación: next/image la guardaría y mostraría una foto vieja.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageUrl} alt={`Última imagen de ${camera.name}`} className="size-full object-cover" />;
}

/** La foto exacta que analizó el agente, con los recuadros de esa misma foto. */
function AgentCapture({ camera, detection }: { camera: Camera; detection: Detection }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto guardada por el agente en public/live */}
      <img src={detection.frameUrl} alt={`Captura del agente en ${camera.name}`} className="size-full object-cover" />
      <DetectionOverlay regions={detection.regions} materials={detection.materials} />
    </>
  );
}

/** Video de la demo con los recuadros que Python calculó cuadro a cuadro. */
function DemoVideo({ camera }: { camera: Camera }) {
  const { data: track } = useTrack(camera.id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const regions = useVideoRegions(videoRef, track ?? []);

  return (
    <figure className="relative size-full">
      <video ref={videoRef} src={camera.videoUrl ?? undefined} poster={camera.imageUrl} autoPlay muted loop playsInline
        className="size-full object-cover" />
      <DetectionOverlay regions={regions} materials={[]} />
      <figcaption className="absolute inset-x-0 bottom-[9%] text-center text-[11px] text-muted">
        {camera.attribution}
      </figcaption>
    </figure>
  );
}
