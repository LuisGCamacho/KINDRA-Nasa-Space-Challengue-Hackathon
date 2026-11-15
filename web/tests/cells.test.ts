import { describe, expect, it } from "vitest";
import { cellsInBbox } from "@/server/cells";
import type { CellsMonth } from "@/lib/types";

/** Recuadro aproximado del condado de Shasta, solo para la prueba: `[oeste, sur, este, norte]`. */
const SHASTA_BBOX: [number, number, number, number] = [-123.07, 40.28, -121.32, 41.19];

const month: CellsMonth = {
  res: 0.1,
  cells: [
    [40.6, -122.4, 12, 35.2], // Redding: dentro
    [40.28, -123.07, 3, 10], // justo en la esquina suroeste
    [34.05, -118.24, 7, 20], // Los Ángeles: fuera
    [-122.4, 40.6, 1, 1], // lat y lon al revés: fuera
  ],
};

describe("cellsInBbox", () => {
  it("deja las celdas dentro del recuadro, bordes incluidos, y conserva la resolución", () => {
    expect(cellsInBbox(month, SHASTA_BBOX)).toEqual({
      res: 0.1,
      cells: [
        [40.6, -122.4, 12, 35.2],
        [40.28, -123.07, 3, 10],
      ],
    });
  });

  it("devuelve una lista vacía si no hay celdas en el recuadro", () => {
    expect(cellsInBbox(month, [0, 0, 1, 1]).cells).toEqual([]);
  });
});
