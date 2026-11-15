import { describe, expect, it } from "vitest";
import { comparePeriod } from "@/server/stats";
import type { MonthRow, Series } from "@/lib/types";

/** Fila de prueba: solo importan `t` y las columnas que se comparan. */
function row(t: string, harm: number, viirs: number | null = null): MonthRow {
  return { t, raw: harm, harm, lo: harm, hi: harm, modis: harm, viirs, src: "prueba", partial: false };
}

/** Serie con un valor de julio por año; el resto de los meses no hace falta. */
function julySeries(values: Record<number, number>): Series {
  return { zoneId: "prueba", months: Object.entries(values).map(([year, value]) => row(`${year}-07`, value)) };
}

const july2026 = { from: "2026-07", to: "2026-07" };

describe("comparePeriod", () => {
  it("compara contra la mediana del mismo mes en los años anteriores", () => {
    const result = comparePeriod(julySeries({ 2023: 10, 2024: 20, 2025: 30, 2026: 110 }), july2026);
    expect(result).toEqual({
      ok: true,
      stats: {
        current: 110,
        median: 20,
        mean: 20,
        ratio: 5.5,
        percentile: 100,
        level: "Muy alto",
        history: [
          { year: 2023, value: 10 },
          { year: 2024, value: 20 },
          { year: 2025, value: 30 },
        ],
      },
    });
  });

  it("usa el promedio de los dos del medio cuando los años son pares", () => {
    const result = comparePeriod(julySeries({ 2024: 10, 2025: 20, 2026: 15 }), july2026);
    expect(result.ok && result.stats).toMatchObject({ median: 15, ratio: 1, level: "Normal", percentile: 50 });
  });

  it("aplica los umbrales que se le pasan", () => {
    const result = comparePeriod(julySeries({ 2025: 10, 2026: 20 }), july2026, "harm", { high: 2.5, veryHigh: 4 });
    expect(result.ok && result.stats.level).toBe("Normal");
  });

  it("no cuenta como 0 un año sin dato: lo deja fuera del historial", () => {
    const series: Series = {
      zoneId: "prueba",
      months: [row("2011-07", 50, null), row("2012-07", 4, 20), row("2013-07", 6, 30), row("2026-07", 9, 75)],
    };
    const result = comparePeriod(series, july2026, "viirs");
    expect(result.ok && result.stats.history).toEqual([
      { year: 2012, value: 20 },
      { year: 2013, value: 30 },
    ]);
  });

  it("suma los meses de un período que cruza el año", () => {
    const series: Series = {
      zoneId: "prueba",
      months: [row("2024-12", 1), row("2025-01", 2), row("2025-12", 3), row("2026-01", 5)],
    };
    const result = comparePeriod(series, { from: "2025-12", to: "2026-01" });
    expect(result.ok && result.stats).toMatchObject({ current: 8, median: 3, history: [{ year: 2024, value: 3 }] });
  });

  it("con mediana 0 no divide: Muy alto si hubo fuego y Normal si no", () => {
    const withFire = comparePeriod(julySeries({ 2024: 0, 2025: 0, 2026: 12 }), july2026);
    const withoutFire = comparePeriod(julySeries({ 2024: 0, 2025: 0, 2026: 0 }), july2026);
    expect(withFire.ok && withFire.stats).toMatchObject({ ratio: null, level: "Muy alto" });
    expect(withoutFire.ok && withoutFire.stats).toMatchObject({ ratio: null, level: "Normal" });
  });

  it("con menos de 10 celdas-día no sube de Normal, aunque el cociente sea alto", () => {
    // Trinity, diciembre de 2025: 3 celdas-día contra una mediana de 1.
    const fewCells = comparePeriod(julySeries({ 2024: 1, 2025: 1, 2026: 3 }), july2026);
    const fewCellsNoHistory = comparePeriod(julySeries({ 2024: 0, 2025: 0, 2026: 4 }), july2026);
    expect(fewCells.ok && fewCells.stats).toMatchObject({ ratio: 3, level: "Normal" });
    expect(fewCellsNoHistory.ok && fewCellsNoHistory.stats).toMatchObject({ ratio: null, level: "Normal" });
  });

  it("desde 10 celdas-día el nivel sale del cociente", () => {
    const result = comparePeriod(julySeries({ 2024: 2, 2025: 2, 2026: 10 }), july2026);
    expect(result.ok && result.stats).toMatchObject({ ratio: 5, level: "Muy alto" });
  });

  it("con pocas celdas-día puede ser Bajo: la regla solo frena las alarmas", () => {
    const result = comparePeriod(julySeries({ 2024: 50, 2025: 50, 2026: 3 }), july2026);
    expect(result.ok && result.stats.level).toBe("Bajo");
  });

  it("avisa si la serie no llega al mes pedido", () => {
    expect(comparePeriod(julySeries({ 2025: 10 }), july2026)).toEqual({ ok: false, reason: "sin_periodo" });
  });

  it("avisa si el mes pedido no tiene dato en esa columna", () => {
    const series: Series = { zoneId: "prueba", months: [row("2025-07", 1, 2), row("2026-07", 1, null)] };
    expect(comparePeriod(series, july2026, "viirs")).toEqual({ ok: false, reason: "sin_dato" });
  });

  it("avisa si no hay años anteriores para comparar", () => {
    expect(comparePeriod(julySeries({ 2026: 10 }), july2026)).toEqual({ ok: false, reason: "sin_historial" });
  });
});
