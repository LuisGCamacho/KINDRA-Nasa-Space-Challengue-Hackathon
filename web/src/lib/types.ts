/**
 * Contratos de datos de KINDRA, compartidos por la API (`src/app/api/`),
 * la lógica del servidor (`src/server/`) y la interfaz.
 *
 * Python (Datos y Backend 2) escribe los JSON de `web/data/` con esta misma forma.
 * Cambiar un campo es cambiar un contrato: se acuerda con el equipo antes.
 */

/** Mes en formato `YYYY-MM`, por ejemplo `"2026-07"`. Ayudas en `lib/period.ts`. */
export type YearMonth = string;

// ─── Zonas ──────────────────────────────────────────────────────────────

/** Nivel administrativo o tipo de área de una zona. */
export type ZoneType = "pais" | "provincia" | "departamento" | "area_protegida" | "personalizada";

/** Zona consultable. Fuente: `web/data/zones.json` o la tabla `zones`. */
export interface Zone {
  /** Identificador estable, en minúsculas con guiones, por ejemplo `"us-ca-shasta"`. */
  id: string;
  name: string;
  type: ZoneType;
  /** Zona que la contiene, por ejemplo la provincia de un departamento. */
  parent?: string;
  country: string;
  /** Centro en `[lon, lat]`, en grados. */
  center: [number, number];
  /** Recuadro en `[oeste, sur, este, norte]`, en grados. */
  bbox: [number, number, number, number];
  areaKm2: number;
}

// ─── Series mensuales ───────────────────────────────────────────────────

/** Fila mensual de la serie de una zona. Las cifras son celdas-día, no píxeles. */
export interface MonthRow {
  t: YearMonth;
  /** Suma directa de todos los sensores, sin armonizar. */
  raw: number;
  /** Serie armonizada en escala MODIS: VIIRS multiplicado por el factor k del mes. */
  harm: number;
  /** Límite inferior del intervalo de `harm` (bootstrap del factor k). */
  lo: number;
  /** Límite superior del intervalo de `harm`. */
  hi: number;
  /** Celdas-día MODIS; `null` si no hay dato MODIS para ese mes. */
  modis: number | null;
  /** Celdas-día VIIRS; `null` si no hay dato VIIRS, por ejemplo antes de 2012. */
  viirs: number | null;
  /** Satélite de referencia usado en el mes, por ejemplo `"VIIRS_SNPP"`. Lo define Datos. */
  src: string;
  /** `true` si el mes está incompleto o tiene datos provisionales de FIRMS. */
  partial: boolean;
}

/** Serie completa de una zona: una fila por mes desde 2000-11, en orden ascendente. */
export interface Series {
  zoneId: string;
  months: MonthRow[];
}

/** Columna de `MonthRow` sobre la que se calcula. */
export type SeriesKind = "harm" | "raw" | "modis" | "viirs";

// ─── Comparación contra lo normal ──────────────────────────────────────

/** Nivel del mes frente a la mediana del mismo mes. Umbrales en `lib/levels.ts`. */
export type Level = "Muy alto" | "Alto" | "Normal" | "Bajo";

/** Respuesta de `/api/stats`: el período elegido contra los mismos meses de años anteriores. */
export interface Stats {
  /** Valor del período elegido. */
  current: number;
  /** Mediana del mismo período en años anteriores; `null` sin historial. */
  median: number | null;
  /** Promedio del mismo período en años anteriores; `null` sin historial. */
  mean: number | null;
  /** `current / median`; `null` si no se puede calcular. */
  ratio: number | null;
  /** Porcentaje de años anteriores con un valor menor a `current` (0–100). */
  percentile: number | null;
  level: Level;
  /** Valor del mismo período en cada año anterior, del más antiguo al más reciente. */
  history: { year: number; value: number }[];
}

// ─── Mapa ───────────────────────────────────────────────────────────────

/**
 * Celda con fuego: `[lat, lon, celdasDia, frpMax]`.
 * El orden es lat, lon: al revés que `Zone.center`. `frpMax` está en MW.
 */
export type CellTuple = [lat: number, lon: number, cellDays: number, frpMax: number];

/** Respuesta de `/api/cells` y forma de `web/data/cells/{ca|world}/{YYYY-MM}.json`. */
export interface CellsMonth {
  /** Tamaño de la celda en grados: 0,1 en California y 0,5 en el resto del mundo. */
  res: number;
  cells: CellTuple[];
}

// ─── Alertas y reportes ─────────────────────────────────────────────────

/** Fila de `/api/alerts`: una zona en 1,5× o más de su mediana. */
export interface Alert {
  zone: string;
  ratio: number | null;
  level: Level;
  /** Primer mes de la racha de meses seguidos en alerta. */
  since: YearMonth;
  /** Satélite de referencia del período. */
  sensor: string;
}

/** Respuesta de `/api/reports/bulletin`. */
export interface Bulletin {
  text: string;
  level: Level;
}

// ─── Próximas 24 h (lo genera Backend 2) ───────────────────────────────

/** Pronóstico de una zona. */
export interface ZoneForecast {
  zoneId: string;
  /** Probabilidad de focos nuevos en las próximas 24 h (0–1). */
  p: number;
  /** Rango esperado de focos `[mínimo, máximo]`. */
  expected: [number, number];
  trend: "sube" | "estable" | "baja";
}

/** Respuesta de `/api/forecast` y forma de `web/data/forecast/latest.json`. */
export interface Forecast {
  /** Fecha y hora de emisión, ISO 8601 en UTC. */
  issued: string;
  /** Una fila por zona, de mayor a menor probabilidad. */
  zones: ZoneForecast[];
  /** Métricas del modelo; `null` hasta que se calculen. */
  metrics: { precision: number | null; recall: number | null; auc: number | null };
}

// ─── Errores ────────────────────────────────────────────────────────────

/** Cuerpo de toda respuesta de error de la API (400, 404, 500). */
export interface ApiError {
  error: string;
}

//--- Validacion 
/**Una metrica de la validacion de la armonizacion */
export interface ValidationItem {
    /**Identificador de la metrica */
    name: string;
    /**Valor calculado: null mientras este pendiente */
    value: number | null;
    /**Contexto de la metrica: unidad, años comparados, serie usada */
    detail: Record<string, string | number | null>;
}

/**Forma de web/data/validation.json */
export interface Validation {
    items: ValidationItem[];
}

/** Factor de armonización VIIRS -> MODIS por región, satélite y mes. */
export interface HarmonizationFactor {
  region: string;
  sat: string;
  month: number;
  k: number;
  kLow: number;
  kHigh: number;
  nYears: number;
}

/** Factores de armonización VIIRS -> MODIS. */
export interface HarmonizationFactors {
  calibration: string;
  factors: HarmonizationFactor[];
}
