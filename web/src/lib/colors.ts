import type { Level } from "./types";

// Rampa Fuego de 6 tonos (manual, sección 13).
export const HEAT = ["#F4F3F1", "#F6EEE8", "#F9CDB5", "#EF8D67", "#D64C29", "#892122"];
export function heatClass(v: number, max: number) {
  const r = max ? v / max : 0;
  return r === 0 ? 0 : r < 0.12 ? 1 : r < 0.28 ? 2 : r < 0.5 ? 3 : r < 0.8 ? 4 : 5;
}

export const LEVEL_LABEL: Record<Level, string> = { "Muy alto": "Muy alto", Alto: "Alto", Normal: "Normal", Bajo: "Bajo" };
export const LEVEL_STYLE: Record<Level, string> = {
  "Muy alto": "bg-crit text-white",
  Alto: "bg-fire-soft text-fire-ink",
  Normal: "bg-ok-soft text-ok",
  Bajo: "bg-secondary text-ink-2",
};
