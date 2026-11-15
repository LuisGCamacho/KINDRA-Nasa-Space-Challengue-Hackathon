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

// TODO(Front): borrar este bloque junto con los componentes viejos (`components/ui.tsx`,
// `HeatCalendar.tsx`, `Inspector.tsx`, `ZonePicker.tsx`, `ZoneMap.tsx`, `Sidebar.tsx`) cuando
// el equipo apruebe los borrados de la sección 1.1 del tutorial. Las pantallas nuevas no lo usan.

/** @deprecated Rampa clara de KINDRA 3. Usar `HEAT_RAMP`. */
export const HEAT = ["#F4F3F1", "#F6EEE8", "#F9CDB5", "#EF8D67", "#D64C29", "#892122"];

/** @deprecated Usar `heatIndex`. */
export function heatClass(v: number, max: number) {
  return heatIndex(v, max);
}

/** @deprecated Usar `LEVEL_COLOR`. */
export const LEVEL_LABEL: Record<Level, string> = { "Muy alto": "Muy alto", Alto: "Alto", Normal: "Normal", Bajo: "Bajo" };

/** @deprecated Usar `LEVEL_COLOR` y `components/ui/LevelBadge`. */
export const LEVEL_STYLE: Record<Level, string> = {
  "Muy alto": "bg-crit text-white",
  Alto: "bg-fire-soft text-fire-ink",
  Normal: "bg-ok-soft text-ok",
  Bajo: "bg-secondary text-ink-2",
};
