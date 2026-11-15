import { describe, expect, it } from "vitest";
import type { MonthRow } from "@/lib/types";
import { yearlyTotals } from "@/lib/yearly";

function month(t: string, raw: number, harm: number, partial = false): MonthRow {
  return { t, raw, harm, lo: harm, hi: harm, modis: harm, viirs: null, src: "MODIS_AQUA", partial };
}

const year = (y: number, raw: number, harm: number, partial = false) =>
  Array.from({ length: 12 }, (_, k) => month(`${y}-${String(k + 1).padStart(2, "0")}`, raw, harm, partial && k === 11));

describe("totales por año para el gráfico de Armonización", () => {
  it("suma los 12 meses de cada año", () => {
    expect(yearlyTotals([...year(2011, 1, 1), ...year(2012, 5, 1)])).toEqual([
      { year: 2011, raw: 12, harm: 12 },
      { year: 2012, raw: 60, harm: 12 },
    ]);
  });

  it("deja afuera los años incompletos o provisionales", () => {
    const totals = yearlyTotals([...year(2025, 1, 1, true), month("2026-01", 3, 3)]);
    expect(totals).toEqual([]);
  });
});
