import type { Settings } from "./types";
import { getMonthSummary } from "./data";

/** El CSV que se ve en Reportes y el que baja /api/csv salen de aquí: es el mismo texto. */
export async function buildCsv(mes: string, s: Settings) {
  const rows = await getMonthSummary(mes, s);
  const head = "periodo,zona,focos,mediana,ratio,incertidumbre_pct,sensor,metodo,version";
  const body = rows.map((d) =>
    [mes, d.zone.name, d.focos, d.mediana, d.ratio.toFixed(2), d.incertidumbrePct, d.sensor, "celdas-dia", "kindra-0.2"].join(","),
  );
  return [head, ...body].join("\n") + "\n";
}
