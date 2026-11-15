import type { Level } from "./types";
import type { FireLabel, MaterialLabel, WaterKind } from "./alert-types";

/**
 * Cuatro fases del fuego, de la chispa al incendio: cuanto más peligroso el nivel,
 * más rojo. El rojo sigue siendo solo para el fuego.
 */
export const LEVEL_COLOR: Record<Level, string> = {
  Bajo: "#FFD166",      // chispa
  Normal: "#F5A623",    // llama
  Alto: "#EE6A24",      // fuego vivo
  "Muy alto": "#D7262B", // incendio
};

/** Color neutro para "sin dato". */
export const NO_DATA_COLOR = "#6B7080";

/** Rampa del calendario: de la noche sin fuego al rojo del incendio. */
export const HEAT_RAMP = ["#14151F", "#4A3A1E", "#B08A2E", "#F5A623", "#EE6A24", "#D7262B"] as const;

/** Índice de `HEAT_RAMP` para un valor, con cortes en 12, 28, 50 y 80 % del máximo. */
export function heatIndex(value: number, max: number): number {
  const share = max > 0 ? value / max : 0;
  if (share <= 0) return 0;
  if (share < 0.12) return 1;
  if (share < 0.28) return 2;
  if (share < 0.5) return 3;
  if (share < 0.8) return 4;
  return 5;
}

/** Marcas en la imagen de la cámara: fuego en tonos de fuego, materiales aparte. */
export const FIRE_LABEL_COLOR: Record<FireLabel, string> = {
  humo: "#D9DCE3",
  llama: "#D7262B",
  anomalia: "#EE6A24",
};

/** Los materiales van en verde azulado para no confundirse con el fuego. */
export const MATERIAL_COLOR = "#34C3B4";

export const MATERIAL_NAME: Record<MaterialLabel, string> = {
  vegetacion: "Vegetación",
  auto: "Auto",
  edificio: "Edificio",
  tanque_combustible: "Tanque de combustible",
};

/** El agua va en azul, el único color frío del mapa. */
export const WATER_COLOR = "#5AA9E6";

export const WATER_NAME: Record<WaterKind, string> = {
  hidrante: "Hidrante",
  rio: "Río",
  lago: "Lago",
  represa: "Represa",
};
