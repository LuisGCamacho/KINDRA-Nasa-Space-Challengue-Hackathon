"use client";

import { useEffect } from "react";
import { useLensStore } from "@/store/useLensStore";
import { useCameras } from "@/hooks/queries";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PillSelect } from "@/components/ui/PillSelect";
import { FieldLabel } from "@/components/ui/FieldLabel";

/** Elige la cámara pública que se ve en la lente y muestra el crédito que pide su dueño. */
export function CameraPanel() {
  const cameraId = useLensStore((state) => state.cameraId);
  const setCamera = useLensStore((state) => state.setCamera);
  const { data: cameras = [] } = useCameras();

  // Si todavía no se eligió ninguna, se abre la primera (en la demo, el video de prueba).
  useEffect(() => {
    if (cameraId === null && cameras.length > 0) setCamera(cameras[0].id);
  }, [cameraId, cameras, setCamera]);

  const camera = cameras.find((item) => item.id === cameraId);

  return (
    <GlassPanel id="camara" title="Cámara" meta={camera?.name}>
      <FieldLabel htmlFor="camara-select">Cámara pública</FieldLabel>
      <PillSelect id="camara-select" value={cameraId ?? ""} onChange={(event) => setCamera(event.target.value)}>
        {cameras.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </PillSelect>

      {camera && (
        <p className="mt-3 text-[12px] text-muted">
          {camera.attribution} ·{" "}
          <a href={camera.termsUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Condiciones de uso
          </a>
        </p>
      )}
    </GlassPanel>
  );
}
