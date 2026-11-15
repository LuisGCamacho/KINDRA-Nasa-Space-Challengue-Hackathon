"use client";

import { useRouter } from "next/navigation";
import { useLensStore } from "@/store/useLensStore";

/**
 * Abre la lupa en modo Cámara con la cámara pedida. Lo usan la cuadrícula de cámaras y la tabla
 * de alertas, así que las dos llevan al mismo lugar: video en vivo, o la captura del agente con
 * sus recuadros si hay detección.
 */
export function useOpenCamera(): (cameraId: string) => void {
  const router = useRouter();
  const setCamera = useLensStore((state) => state.setCamera);
  const setMode = useLensStore((state) => state.setMode);

  return (cameraId) => {
    setCamera(cameraId);
    setMode("camara");
    router.push("/explorar");
  };
}
