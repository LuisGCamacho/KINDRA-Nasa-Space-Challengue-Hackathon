import { isAlertLevel } from "@/lib/levels";
import { addMonths } from "@/lib/period";
import type { Alert, Series, YearMonth } from "@/lib/types";
import { comparePeriod, type Thresholds } from "./stats";

/** Meses hacia atrás que se miran para la racha: más de un año en alerta seguida no cambia la lectura. */
const MAX_STREAK_MONTHS = 24;

/** `true` si ese mes de la serie está en Alto o Muy alto (con o sin cociente: igual cuenta para la racha). */
function isAlertMonth(series: Series, month: YearMonth, thresholds: Thresholds): boolean {
  const result = comparePeriod(series, { from: month, to: month }, "harm", thresholds);
  return result.ok && isAlertLevel(result.stats.level);
}

/** Primer mes de la racha de meses seguidos en alerta que termina en `month`. */
function streakStart(series: Series, month: YearMonth, thresholds: Thresholds): YearMonth {
  let start = month;
  for (let back = 1; back <= MAX_STREAK_MONTHS; back++) {
    const previous = addMonths(month, -back);
    if (!isAlertMonth(series, previous, thresholds)) break;
    start = previous;
  }
  return start;
}

/**
 * Fila de alerta de una zona en un mes, o `null` si la zona no está en Alto o Muy alto.
 *
 * Por ahora deja afuera los meses sin cociente (mediana 0 y 10 celdas-día o más): son alertas
 * reales, pero el contrato `Alert` pide `ratio` como número. Pendiente de decidir con el equipo
 * si `Alert.ratio` pasa a `number | null`.
 */
export function zoneAlert(series: Series, month: YearMonth, thresholds: Thresholds): Alert | null {
  const result = comparePeriod(series, { from: month, to: month }, "harm", thresholds);
  if (!result.ok || result.stats.ratio === null || !isAlertLevel(result.stats.level)) return null;

  const row = series.months.find((item) => item.t === month);
  return {
    zone: series.zoneId,
    ratio: result.stats.ratio,
    level: result.stats.level,
    since: streakStart(series, month, thresholds),
    sensor: row?.src ?? "",
  };
}

/** Alertas de todas las zonas en un mes, del cociente más alto al más bajo. */
export function zoneAlerts(allSeries: Series[], month: YearMonth, thresholds: Thresholds): Alert[] {
  return allSeries
    .map((series) => zoneAlert(series, month, thresholds))
    .filter((alert): alert is Alert => alert !== null)
    .sort((a, b) => b.ratio - a.ratio);
}
