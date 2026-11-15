import { DEFAULT_HIGH, DEFAULT_VERY_HIGH, MIN_CELL_DAYS_FOR_HIGH, levelOf } from "@/lib/levels";
import { addMonths, monthSpan, parseYearMonth } from "@/lib/period";
import type { Level, MonthRow, Series, SeriesKind, Stats, YearMonth } from "@/lib/types";

/** Período a comparar, de `from` a `to` inclusive. Se valida antes con `periodSchema`. */
export interface Period {
  from: YearMonth;
  to: YearMonth;
}

/** Umbrales de nivel; si no vienen, se usan los de `lib/levels.ts`. */
export interface Thresholds {
  high: number;
  veryHigh: number;
}

/**
 * Por qué no se pudo comparar:
 * - `sin_periodo`: la serie no llega a alguno de los meses pedidos.
 * - `sin_dato`: algún mes pedido no tiene valor en esa columna (por ejemplo VIIRS antes de 2012).
 * - `sin_historial`: no hay ningún año anterior completo con el que comparar.
 */
export type CompareFailure = "sin_periodo" | "sin_dato" | "sin_historial";

export type CompareResult = { ok: true; stats: Stats } | { ok: false; reason: CompareFailure };

const DEFAULT_THRESHOLDS: Thresholds = { high: DEFAULT_HIGH, veryHigh: DEFAULT_VERY_HIGH };

/**
 * Compara un período con los mismos meses de los años anteriores.
 */
export function comparePeriod(
  series: Series,
  period: Period,
  kind: SeriesKind = "harm",
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): CompareResult {
  const rows = indexByMonth(series.months);

  const current = sumPeriod(rows, period, kind);
  if (current === "sin_periodo" || current === "sin_dato") return { ok: false, reason: current };

  const history = previousYears(rows, period, kind);
  if (history.length === 0) return { ok: false, reason: "sin_historial" };

  const values = history.map((year) => year.value);
  const median = medianOf(values);
  const ratio = median > 0 ? current / median : null;

  return {
    ok: true,
    stats: {
      current,
      median,
      mean: meanOf(values),
      ratio,
      percentile: (values.filter((value) => value < current).length / values.length) * 100,
      level: levelFor(current, ratio, thresholds),
      history,
    },
  };
}

/** Filas por mes, para buscar cada mes sin recorrer la serie. */
function indexByMonth(months: MonthRow[]): Map<YearMonth, MonthRow> {
  return new Map(months.map((row) => [row.t, row]));
}

/**
 * Suma la columna `kind` en el período. Un mes sin valor (`null`) no cuenta como 0:
 * invalida la suma, porque no se sabe cuánto fuego hubo.
 */
function sumPeriod(
  rows: Map<YearMonth, MonthRow>,
  { from, to }: Period,
  kind: SeriesKind,
): number | "sin_periodo" | "sin_dato" {
  let total = 0;
  for (let offset = 0; offset < monthSpan(from, to); offset++) {
    const row = rows.get(addMonths(from, offset));
    if (!row) return "sin_periodo";
    const value = row[kind];
    if (value === null) return "sin_dato";
    total += value;
  }
  return total;
}

/**
 * El mismo período en cada año anterior que tenga todos sus meses con dato,
 * del más antiguo al más reciente. El año es el de `from`.
 */
function previousYears(rows: Map<YearMonth, MonthRow>, period: Period, kind: SeriesKind): Stats["history"] {
  const firstMonth = [...rows.keys()].sort()[0];
  const history: Stats["history"] = [];

  for (let yearsBack = 1; ; yearsBack++) {
    const shifted = { from: addMonths(period.from, -12 * yearsBack), to: addMonths(period.to, -12 * yearsBack) };
    if (shifted.from < firstMonth) break;

    const value = sumPeriod(rows, shifted, kind);
    if (typeof value === "number") history.push({ year: parseYearMonth(shifted.from).year, value });
  }
  return history.reverse();
}

/**
 * Nivel del período. Sin mediana para dividir (mediana 0), el cociente es infinito si hubo fuego.
 * Con menos de `MIN_CELL_DAYS_FOR_HIGH` celdas-día el nivel no pasa de Normal: es muy poco
 * fuego para dar una alarma, aunque el cociente sea alto.
 */
function levelFor(current: number, ratio: number | null, { high, veryHigh }: Thresholds): Level {
  if (ratio === null && current === 0) return "Normal";
  const level = levelOf(ratio ?? Infinity, high, veryHigh);
  const isHigh = level === "Alto" || level === "Muy alto";
  return isHigh && current < MIN_CELL_DAYS_FOR_HIGH ? "Normal" : level;
}

function medianOf(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function meanOf(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
