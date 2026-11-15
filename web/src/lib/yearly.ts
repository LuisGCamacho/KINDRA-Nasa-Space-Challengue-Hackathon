import type { MonthRow } from "./types";

export interface YearTotal {
  year: number;
  raw: number;
  harm: number;
}

/**
 * Totales por año de la serie cruda y la armonizada, solo de años completos y cerrados
 * (12 meses sin datos provisionales): un año a medias haría parecer que el fuego bajó.
 */
export function yearlyTotals(months: MonthRow[]): YearTotal[] {
  const byYear = new Map<number, MonthRow[]>();
  for (const row of months) {
    const year = Number(row.t.slice(0, 4));
    byYear.set(year, [...(byYear.get(year) ?? []), row]);
  }
  return [...byYear.entries()]
    .filter(([, rows]) => rows.length === 12 && rows.every((row) => !row.partial))
    .map(([year, rows]) => ({
      year,
      raw: rows.reduce((sum, row) => sum + row.raw, 0),
      harm: rows.reduce((sum, row) => sum + row.harm, 0),
    }))
    .sort((a, b) => a.year - b.year);
}
