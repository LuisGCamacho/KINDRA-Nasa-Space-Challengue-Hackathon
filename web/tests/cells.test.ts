import { describe, expect, it } from "vitest";
import { cellsInBbox } from "@/server/cells";
import type { CellsMonth } from "@/lib/types";

const month: CellsMonth = {
  res: 0.1,
  cells: [
    [-29.15, -67.45, 12, 35.2], // dentro de Chilecito
    [-29.5, -67.9, 3, 10], // justo en la esquina suroeste
    [-31.4, -64.2, 7, 20], // Córdoba: fuera
    [-67.45, -29.15, 1, 1], // lat y lon al revés: fuera
  ],
};

describe("cellsInBbox", () => {
  it("deja las celdas dentro del recuadro, bordes incluidos, y conserva la resolución", () => {
    expect(cellsInBbox(month, [-67.9, -29.5, -67.1, -28.8])).toEqual({
      res: 0.1,
      cells: [
        [-29.15, -67.45, 12, 35.2],
        [-29.5, -67.9, 3, 10],
      ],
    });
  });

  it("devuelve una lista vacía si no hay celdas en el recuadro", () => {
    expect(cellsInBbox(month, [0, 0, 1, 1]).cells).toEqual([]);
  });
});
