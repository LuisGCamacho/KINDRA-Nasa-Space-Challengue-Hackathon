import "server-only";
import type { Detection, TrackFrame } from "@/lib/alert-types";
import { listLive, readLive } from "./live-store";

/** Última detección que escribió Python para una cámara, o `null` si no vio humo ni llama. */
export function getLatestDetection(cameraId: string): Promise<Detection | null> {
  return readLive<Detection | null>(`detections/${cameraId}.json`, null);
}

/**
 * La última detección de cada cámara que tiene una. Un solo pedido para toda la cuadrícula: con
 * una ruta por cámara eran 169 pedidos cada 30 s. Los nombres que no pasan el filtro de
 * `live-store` (archivos ajenos en la carpeta) se saltan.
 */
export async function getLatestDetections(): Promise<Detection[]> {
  const names = (await listLive("detections")).filter((name) => /^detections\/[a-z0-9-]+\.json$/.test(name));
  const detections = await Promise.all(names.map((name) => readLive<Detection | null>(name, null)));
  return detections.filter((detection): detection is Detection => detection !== null);
}

/** Recuadros del video de la demo, cuadro a cuadro; lista vacía si la cámara no tiene video analizado. */
export function getTrack(cameraId: string): Promise<TrackFrame[]> {
  return readLive<TrackFrame[]>(`tracks/${cameraId}.json`, []);
}
