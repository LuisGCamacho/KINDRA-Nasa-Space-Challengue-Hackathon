import { sqlClient as sql } from "./client";

export const searchZones = (q: string) => sql!`
  select id, name, type, parent, country from zones
  where name % ${q} or name ilike ${"%" + q + "%"}
  order by similarity(name, ${q}) desc limit 20`;

export const zoneAt = (lon: number, lat: number) => sql!`
  select id, name, type from zones
  where st_contains(geom, st_setsrid(st_point(${lon}, ${lat}), 4326))
  order by area_km2 asc limit 1`;

export const seriesOf = (zoneId: string) => sql!`
  select to_char(month, 'YYYY-MM') as t, raw, harm, lo, hi, modis, viirs, src, partial
  from monthly_series where zone_id = ${zoneId} order by month`;

export const cellsIn = (
  from: string, to: string,
  b: [number, number, number, number], scope: "ar" | "world"
) => sql!`
  select lat, lon, sum(cell_days)::int as n, max(frp_max) as frp from cells_monthly
  where scope = ${scope} and month between ${from + "-01"} and ${to + "-01"}
    and geom && st_makeenvelope(${b[0]}, ${b[1]}, ${b[2]}, ${b[3]}, 4326)
  group by lat, lon limit 20000`;