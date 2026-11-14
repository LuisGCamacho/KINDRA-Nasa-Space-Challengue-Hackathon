import type { YearMonth } from "./types";

/** `YYYY-MM` con mes entre 01 y 12. */
const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Nombres de los meses en minúsculas, para textos como "5,5× lo normal para julio". */
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** Indica si el texto es un mes válido en formato `YYYY-MM`. */
export function isYearMonth(value: string): value is YearMonth {
  return YEAR_MONTH_RE.test(value);
}

/** Separa un mes en año y número de mes (1–12). No valida: usar `isYearMonth` antes. */
export function parseYearMonth(ym: YearMonth): { year: number; month: number } {
  return { year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)) };
}

/** Arma un `YYYY-MM` a partir del año y el número de mes (1–12). */
export function toYearMonth(year: number, month: number): YearMonth {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Suma `n` meses (negativo para restar). */
export function addMonths(ym: YearMonth, n: number): YearMonth {
  const { year, month } = parseYearMonth(ym);
  const index = year * 12 + (month - 1) + n;
  return toYearMonth(Math.floor(index / 12), (index % 12) + 1);
}

/** Cantidad de meses de `from` a `to`, contando los dos: `monthSpan("2026-07", "2026-07") === 1`. */
export function monthSpan(from: YearMonth, to: YearMonth): number {
  const a = parseYearMonth(from);
  const b = parseYearMonth(to);
  return (b.year - a.year) * 12 + (b.month - a.month) + 1;
}

/** Nombre del mes en español, por ejemplo `monthName("2026-07") === "julio"`. */
export function monthName(ym: YearMonth): string {
  return MONTH_NAMES[parseYearMonth(ym).month - 1];
}
