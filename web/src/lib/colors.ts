import type { Level } from "./types";

// Rampa Fuego de 6 tonos (manual, sección 13).
export const HEAT = ["#F4F3F1", "#F6EEE8", "#F9CDB5", "#EF8D67", "#D64C29", "#892122"];
export function heatClass(v: number, max: number) {
  const r = max ? v / max : 0;
  return r === 0 ? 0 : r < 0.12 ? 1 : r < 0.28 ? 2 : r < 0.5 ? 3 : r < 0.8 ? 4 : 5;
}

export const LEVEL_LABEL: Record<Level, string> = { "muy-alto": "Muy alto", alto: "Alto", normal: "Normal", bajo: "Bajo" };
export const LEVEL_STYLE: Record<Level, string> = {
  "muy-alto": "bg-crit text-white",
  alto: "bg-fire-soft text-fire-ink",
  normal: "bg-ok-soft text-ok",
  bajo: "bg-secondary text-ink-2",
};
