"use client";

import { useCameras } from "@/hooks/queries";
import { useOpenCamera } from "@/hooks/useOpenCamera";

/** Nombre de la cámara de una alerta; al tocarlo abre la cámara en la lupa. */
export function CameraLink({ cameraId }: { cameraId: string }) {
  const { data: cameras } = useCameras();
  const openCamera = useOpenCamera();
  const camera = cameras?.find((item) => item.id === cameraId);

  // Una alerta vieja puede ser de una cámara que ya no está en la lista: se muestra el id sin enlace.
  if (cameras && !camera) return <span className="text-muted">{cameraId}</span>;

  return (
    <button
      type="button"
      onClick={() => openCamera(cameraId)}
      className="text-left underline decoration-line underline-offset-4 hover:decoration-heading"
    >
      {camera?.name ?? cameraId}
    </button>
  );
}
