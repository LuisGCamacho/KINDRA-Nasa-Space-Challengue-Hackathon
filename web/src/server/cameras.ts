import "server-only";
import type { Detection, TrackFrame } from "@/lib/alert-types";
import { readLive } from "./live-store";

/** Última detección que escribió Python para una cámara, o `null` si no vio humo ni llama. */
export function getLatestDetection(cameraId: string): Promise<Detection | null> {
  return readLive<Detection | null>(`detections/${cameraId}.json`, null);
}

/** Recuadros del video de la demo, cuadro a cuadro; lista vacía si la cámara no tiene video analizado. */
export function getTrack(cameraId: string): Promise<TrackFrame[]> {
  return readLive<TrackFrame[]>(`tracks/${cameraId}.json`, []);
}
