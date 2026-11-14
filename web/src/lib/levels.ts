import type { Level } from "./types";

/** El nivel sale del cociente contra la mediana del mismo mes. Los umbrales vienen de Ajustes. */
export function levelFor(ratio: number, t: { altoDesde: number; muyAltoDesde: number }): Level {
  if (ratio >= t.muyAltoDesde) return "muy-alto";
  if (ratio >= t.altoDesde) return "alto";
  if (ratio >= 0.67) return "normal";
  return "bajo";
}
