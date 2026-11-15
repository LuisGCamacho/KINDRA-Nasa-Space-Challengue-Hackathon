python -m kindra load

from __future__ import annotations

import json
import os

import geopandas as gpd
import pandas as pd
from shapely.geometry import MultiPolygon, Polygon
from sqlalchemy import create_engine, text

from kindra.config import INTERIM, WEB_DATA

TABLES = ["forecasts", "validation", "factors", "cells_monthly", "monthly_series", "zones"]


def engine():
    """Conexión con psycopg 3 a partir de `DATABASE_URL`."""
    url = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://", 1)
    return create_engine(url)


def as_multipolygon(geometry):
    """La tabla `zones` guarda MultiPolygon; un Polygon suelto se envuelve."""
    return MultiPolygon([geometry]) if isinstance(geometry, Polygon) else geometry


def first_of_month(months: pd.Series) -> pd.Series:
    """`YYYY-MM` → fecha del día 1, el tipo de la columna `month`."""
    return pd.to_datetime(months + "-01").dt.date


def load_all() -> None:
    db = engine()
    with db.begin() as connection:
        connection.execute(text(f"truncate {', '.join(TABLES)} cascade"))

    zones = gpd.read_parquet(INTERIM / "zones.parquet")
    zones = zones.assign(geometry=zones.geometry.map(as_multipolygon))
    zones["area_km2"] = zones.to_crs("EPSG:6933").area / 1e6
    zones.rename_geometry("geom").to_postgis("zones", db, if_exists="append", index=False)

    series = pd.read_parquet(INTERIM / "monthly_series.parquet")
    series = series.assign(month=first_of_month(series["t"])).drop(columns="t")
    series.to_sql("monthly_series", db, if_exists="append", index=False, chunksize=10_000)

    cells = pd.read_parquet(INTERIM / "cells_monthly.parquet")
    cells = cells.assign(month=first_of_month(cells["t"])).rename(columns={"clat": "lat", "clon": "lon"})
    cells.drop(columns="t").to_sql("cells_monthly", db, if_exists="append", index=False, chunksize=10_000)

    pd.read_parquet(INTERIM / "factors.parquet").to_sql("factors", db, if_exists="append", index=False)
    _load_json_tables(db)


def _load_json_tables(db) -> None:
    """Pronóstico y validación salen de los JSON que ya escribió Python."""
    forecast = json.loads((WEB_DATA / "forecast" / "latest.json").read_text(encoding="utf-8"))
    validation = json.loads((WEB_DATA / "validation.json").read_text(encoding="utf-8"))
    with db.begin() as connection:
        connection.execute(text("insert into forecasts (issued, payload) values (:issued, cast(:payload as jsonb))"),
                           {"issued": forecast["issued"], "payload": json.dumps(forecast)})
        for item in validation["items"]:
            connection.execute(
                text("insert into validation (name, value, detail) values (:name, :value, cast(:detail as jsonb))"),
                {"name": item["name"], "value": item["value"], "detail": json.dumps(item["detail"])})
