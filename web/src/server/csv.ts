import type { MonthRow, Series, YearMonth } from "@/lib/types";

/** Versión del método que va en cada fila: si cambia el método, cambia esta etiqueta. */
export const METHOD_VERSION = "kindra-celdas-dia-k2012-2021";

/**
 * Marca de orden de bytes (BOM). Sin ella, Excel en español abre el UTF-8 como Latin-1
 * y las tildes salen rotas.
 */
const BOM = "﻿";

/** Excel en español usa `;` entre columnas y `,` para los decimales. */
const SEPARATOR = ";";

/** Saltos de línea de Windows: Excel los lee siempre bien. */
const NEWLINE = "\r\n";

const COLUMNS = [
  "mes",
  "celdas_dia_armonizadas",
  "limite_inferior",
  "limite_superior",
  "celdas_dia_crudas",
  "modis",
  "viirs",
  "satelite_referencia",
  "parcial",
  "metodo",
] as const;

/**
 * Número con coma decimal y sin separador de miles, para que Excel lo lea como número.
 * Hasta 4 decimales, sin ceros de más. `null` es una celda vacía: sin dato, no 0.
 */
function formatNumber(value: number | null): string {
  if (value === null) return "";
  return String(Number(value.toFixed(4))).replace(".", ",");
}

/** Pone entre comillas el texto que tenga separador, comillas o saltos de línea. */
function escapeCell(text: string): string {
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowCells(row: MonthRow): string[] {
  return [
    row.t,
    formatNumber(row.harm),
    formatNumber(row.lo),
    formatNumber(row.hi),
    formatNumber(row.raw),
    formatNumber(row.modis),
    formatNumber(row.viirs),
    row.src,
    row.partial ? "sí" : "no",
    METHOD_VERSION,
  ];
}

/**
 * CSV de la serie mensual de una zona, listo para Excel: BOM, `;`, coma decimal y CRLF.
 * Con `from` y `to` deja solo esos meses (inclusive); sin ellos va la serie completa.
 */
export function buildSeriesCsv(series: Series, range?: { from: YearMonth; to: YearMonth }): string {
  const rows = range ? series.months.filter((row) => row.t >= range.from && row.t <= range.to) : series.months;
  const lines = [COLUMNS.join(SEPARATOR), ...rows.map((row) => rowCells(row).map(escapeCell).join(SEPARATOR))];
  return BOM + lines.join(NEWLINE) + NEWLINE;
}
