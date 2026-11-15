-- ¿Qué zona contiene este punto?
select id, name, type from zones
where st_contains(geom, st_setsrid(st_point(-67.50, -29.16), 4326))
order by area_km2 asc limit 1;

-- Búsqueda por nombre con errores
select id, name from zones
where name % 'chilesito'
order by similarity(name, 'chilesito') desc limit 5;

-- Serie de una zona
select to_char(month, 'YYYY-MM') as t, raw, harm from monthly_series
where zone_id = 'ar-lr-chilecito' order by month;

-- Celdas dentro de un recuadro
select lat, lon, sum(cell_days) as n from cells_monthly
where scope = 'ar' and month = '2026-07-01'
  and geom && st_makeenvelope(-67.9, -29.5, -67.1, -28.8, 4326)
group by lat, lon;