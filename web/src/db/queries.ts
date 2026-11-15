import "server-only";
import type {
  CellsMonth, CellTuple, Forecast, HarmonizationFactors, MonthRow, Series, Validation, YearMonth, Zone,
} from "@/lib/types";
import { sql } from "./client";

/*
  Consultas a Postgres con la misma forma que los JSON de web/data/.
  Las llama solo `server/data.ts`, que vuelve al JSON si la base falla.
*/

/** Resolución de la grilla de cada alcance, igual que en `ml/kindra/config.py`. */
const RESOLUTION = { ar: 0.1, world: 0.5 } as const;

export const hasDatabase = () => sql !== null;

function db() {
  if (!sql) throw new Error("Falta DATABASE_URL");
  return sql;
}

/** Zonas con centro y recuadro calculados por PostGIS. */
export async function listZones(): Promise<Zone[]> {
  const rows = await db()`
    select id, name, type, parent, country, area_km2,
           st_x(st_pointonsurface(geom)) as lon, st_y(st_pointonsurface(geom)) as lat,
           st_xmin(geom) as west, st_ymin(geom) as south, st_xmax(geom) as east, st_ymax(geom) as north
    from zones order by name`;
  return rows.map((r) => ({
    id: r.id, name: r.name, type: r.type, parent: r.parent ?? undefined, country: r.country,
    center: [r.lon, r.lat], bbox: [r.west, r.south, r.east, r.north], areaKm2: Math.round(r.area_km2),
  }));
}

export async function seriesOf(zoneId: string): Promise<Series | null> {
  const months = await db()<MonthRow[]>`
    select to_char(month, 'YYYY-MM') as t, raw, harm, lo, hi, modis, viirs, src, partial
    from monthly_series where zone_id = ${zoneId} order by month`;
  return months.length ? { zoneId, months } : null;
}

export async function cellsOf(scope: keyof typeof RESOLUTION, month: YearMonth): Promise<CellsMonth | null> {
  const rows = await db()`
    select lat, lon, cell_days, frp_max from cells_monthly
    where scope = ${scope} and month = ${`${month}-01`}::date`;
  if (!rows.length) return null;
  const cells = rows.map((r): CellTuple => [r.lat, r.lon, r.cell_days, r.frp_max ?? 0]);
  return { res: RESOLUTION[scope], cells };
}

export async function latestForecast(): Promise<Forecast | null> {
  const [row] = await db()`select payload from forecasts order by issued desc limit 1`;
  return (row?.payload as Forecast | undefined) ?? null;
}

export async function validationItems(): Promise<Validation | null> {
  const items = await db()`select name, value, detail from validation order by name`;
  return items.length ? { items: items.map((r) => ({ name: r.name, value: r.value, detail: r.detail })) } : null;
}

export async function factors(): Promise<HarmonizationFactors | null> {
  const rows = await db()`
    select region, sat, month, k, k_low, k_high, n_years from factors order by region, sat, month`;
  if (!rows.length) return null;
  return {
    calibration: "2012–2021",
    factors: rows.map((r) => ({
      region: r.region, sat: r.sat, month: r.month, k: r.k, kLow: r.k_low, kHigh: r.k_high, nYears: r.n_years,
    })),
  };
}

/** Para `/api/health`: tarda lo que tarda un viaje a la base. */
export async function ping(): Promise<void> {
  await db()`select 1`;
}
