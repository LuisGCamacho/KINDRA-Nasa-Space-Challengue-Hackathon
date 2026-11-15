create extension if not exists postgis;
create extension if not exists pg_trgm;

create table if not exists zones (
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
create index if not exists zones_geom_idx on zones using gist (geom);
create index if not exists zones_name_idx on zones using gin (name gin_trgm_ops);

create table if not exists  monthly_series (
  zone_id text references zones(id) on delete cascade,
  month date not null,
  raw int, harm real, lo real, hi real,
  modis int, viirs int, src text,
  partial boolean default false,
  primary key (zone_id, month)
);

create table if not exists  cells_monthly (
  scope text not null,
  month date not null,
  lat real not null,
  lon real not null,
  cell_days int not null,
  frp_max real,
  geom geometry(Point, 4326)
    generated always as (st_setsrid(st_makepoint(lon, lat), 4326)) stored
);
create index if not exists cells_month_idx on cells_monthly (scope, month);
create index if not exists cells_geom_idx on cells_monthly using gist (geom);

create table if not exists  factors (
  region text, month int, k real, k_low real, k_high real, n_years int,
  primary key (region, month)
);

create table if not exists  forecasts (
  zone_id text references zones(id),
  issued date,
  payload jsonb,
  primary key (zone_id, issued)
);

create table if not exists  validation (
  name text primary key,
  value real,
  detail jsonb
);

create table if not exists  custom_zones (
  id text primary key,
  name text,
  geom geometry(Polygon, 4326),
  created_at timestamptz default now()
);