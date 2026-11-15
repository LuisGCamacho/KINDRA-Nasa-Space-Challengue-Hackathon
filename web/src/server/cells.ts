import type { CellsMonth } from "@/lib/types";

/** Recuadro `[oeste, sur, este, norte]` en grados, el mismo orden que `Zone.bbox`. */
export type Bbox = [west: number, south: number, east: number, north: number];

/**
 * Deja solo las celdas cuyo centro cae dentro del recuadro (bordes incluidos).
 * Ojo con el orden: la celda es `[lat, lon, …]` y el recuadro empieza por la longitud.
 */
export function cellsInBbox({ res, cells }: CellsMonth, [west, south, east, north]: Bbox): CellsMonth {
  return {
    res,
    cells: cells.filter(([lat, lon]) => lon >= west && lon <= east && lat >= south && lat <= north),
  };
}
