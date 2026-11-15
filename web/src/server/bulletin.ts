import { num } from "@/lib/format";
import { DEFAULT_HIGH, MIN_CELL_DAYS_FOR_HIGH } from "@/lib/levels";
import { monthName, parseYearMonth } from "@/lib/period";
import type { Bulletin, SeriesKind, Stats } from "@/lib/types";
import type { Period } from "./stats";

/** Lo que necesita el boletín, todo ya calculado: aquí solo se arma el texto. */
export interface BulletinInput {
  zoneName: string;
  period: Period;
  kind: SeriesKind;
  stats: Stats;
  /** `true` si algún mes del período tiene datos provisionales de FIRMS. */
  partial: boolean;
}

/** Reconocimiento que pide NASA FIRMS al usar sus datos (texto en inglés, como lo publica FIRMS). */
export const FIRMS_ACKNOWLEDGMENT =
  "We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS), part of NASA's Earth Science Data and Information System (ESDIS).";

const DISCLAIMER =
  "NASA publica los datos de FIRMS «tal cual» (as is): quien los usa asume la responsabilidad por su uso. " +
  "Este boletín es del equipo KINDRA (NASA Space Apps 2026) y no es un aviso oficial.";

const KIND_TEXT: Record<SeriesKind, string> = {
  harm: "serie armonizada, en escala MODIS",
  raw: "suma directa de todos los satélites, sin armonizar",
  modis: "solo MODIS",
  viirs: "solo VIIRS",
};

/** "enero de 2025", o "noviembre de 2024 a enero de 2025" si el período tiene varios meses. */
function periodText({ from, to }: Period): string {
  const label = (ym: string) => `${monthName(ym)} de ${parseYearMonth(ym).year}`;
  return from === to ? label(from) : `${label(from)} a ${label(to)}`;
}

/** Con qué se compara: "enero" para un mes, "el mismo período" para varios. */
function sameSeasonText({ from, to }: Period): string {
  return from === to ? monthName(from) : "el mismo período";
}

/** Lo mismo, tras "de": "de enero" o "del mismo período". */
function ofSameSeason(period: Period): string {
  return period.from === period.to ? `de ${monthName(period.from)}` : "del mismo período";
}

/** Celdas-día legibles con su unidad: enteras sin decimales; armonizadas (k fraccionario) con uno. */
function cellDays(value: number): string {
  const amount = Number.isInteger(value) ? num(value) : num(value, 1);
  return `${amount} ${value === 1 ? "celda-día" : "celdas-día"}`;
}

function comparisonSentence({ stats, period }: BulletinInput): string {
  const years = stats.history.length;
  if (stats.ratio === null) {
    return `En los ${years} años anteriores, ${sameSeasonText(period)} no tuvo fuego (mediana 0), así que no hay cociente.`;
  }
  return `Es ${num(stats.ratio, 1)}× la mediana ${ofSameSeason(period)} en los ${years} años anteriores (${cellDays(stats.median ?? 0)}).`;
}

function rankSentence({ stats, period }: BulletinInput): string | null {
  const firstYear = stats.history[0]?.year;
  if (stats.percentile === 100) return `Es el valor más alto ${ofSameSeason(period)} desde ${firstYear}.`;
  if (stats.percentile === 0 && stats.current < Math.min(...stats.history.map((year) => year.value))) {
    return `Es el valor más bajo ${ofSameSeason(period)} desde ${firstYear}.`;
  }
  return stats.percentile === null ? null : `Supera al ${num(stats.percentile)} % de los años anteriores.`;
}

/** Aclara por qué un cociente alto quedó en Normal (regla de `MIN_CELL_DAYS_FOR_HIGH`). */
function fewCellsSentence({ stats }: BulletinInput): string | null {
  const wouldBeHigh = stats.ratio === null ? stats.current > 0 : stats.ratio >= DEFAULT_HIGH;
  if (!wouldBeHigh || stats.current >= MIN_CELL_DAYS_FOR_HIGH) return null;
  return `Son menos de ${MIN_CELL_DAYS_FOR_HIGH} celdas-día: es muy poco fuego para dar una alarma, por eso el nivel queda en Normal.`;
}

/**
 * Boletín en texto plano del período de una zona. Cada número sale de `stats`:
 * el texto no agrega ninguna cifra que no esté calculada.
 */
export function buildBulletin(input: BulletinInput): Bulletin {
  const { zoneName, period, kind, stats, partial } = input;
  const summary = [
    `Se registraron ${cellDays(stats.current)} de fuego (${KIND_TEXT[kind]}).`,
    comparisonSentence(input),
    rankSentence(input),
    fewCellsSentence(input),
    partial ? "Incluye datos provisionales de FIRMS: la cifra puede cambiar." : null,
  ].filter((sentence): sentence is string => sentence !== null);

  const text = [
    `${zoneName} · ${periodText(period)} · ${stats.level}`,
    "",
    summary.join(" "),
    "",
    "Fuente: NASA FIRMS (MODIS y VIIRS), armonizado por KINDRA. Una celda de la grilla con fuego en un día cuenta una vez (celda-día).",
    FIRMS_ACKNOWLEDGMENT,
    DISCLAIMER,
  ].join("\n");

  return { text, level: stats.level };
}
