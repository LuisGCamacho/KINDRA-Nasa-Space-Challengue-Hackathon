import type { FireLabel } from "./alert-types";

/** Nombre que ve el usuario para cada etiqueta del modelo. */
export const FIRE_LABEL_NAME: Record<FireLabel, string> = {
  humo: "Humo",
  llama: "Llama",
  anomalia: "Anomalía",
};

/** 0,873 → "87 %". */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)} %`;
}

export function getDetectionDescription(confidence: number, source: string): string {
  const level = confidence > 80 ? "Alta" : confidence > 50 ? "Media" : "Baja";
  return `Foco detectado por ${source.toUpperCase()} con una confianza de ${confidence}% (${level}).`;
}