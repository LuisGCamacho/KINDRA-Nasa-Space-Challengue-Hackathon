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
