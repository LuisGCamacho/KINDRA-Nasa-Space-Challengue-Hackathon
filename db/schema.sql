create extension if not exists postgis;
create extension if not exists pg_trgm;

create table if not exists custom_zones, validation, forecasts, factors,
                     cells_monthly, monthly_series, zones cascade;

create table zones (
  id text primary key,
  name text not null,
  type text not null,
  parent text,
  country text not null,
  center double precision[] not null,
  bbox   double precision[] not null,
  area_km2 double precision not null,
  geom geometry(MultiPolygon, 4326) not null
);
create index zones_geom_idx on zones using gist (geom);
create index zones_name_idx on zones using gin (name gin_trgm_ops);

create table monthly_series (
  zone_id text references zones(id) on delete cascade,
  month date not null,
  raw int, harm real, lo real, hi real,
  modis int, viirs int, src text,
  partial boolean default false,
  primary key (zone_id, month)
);

create table cells_monthly (
  scope text not null,
  month date not null,
  lat real not null,
  lon real not null,
  cell_days int not null,
  frp_max real,
  geom geometry(Point, 4326)
    generated always as (st_setsrid(st_makepoint(lon, lat), 4326)) stored
);
create index cells_month_idx on cells_monthly (scope, month);
create index cells_geom_idx on cells_monthly using gist (geom);

create table factors (
  region text, month int, k real, k_low real, k_high real, n_years int,
  primary key (region, month)
);

create table forecasts (
  zone_id text references zones(id),
  issued date,
  payload jsonb,
  primary key (zone_id, issued)
);

create table validation (
  name text primary key,
  value real,
  detail jsonb
);

create table custom_zones (
  id text primary key,
  name text,
  geom geometry(Polygon, 4326),
  created_at timestamptz default now()
);