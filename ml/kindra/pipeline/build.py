"""`python -m kindra build`: de los CSV de FIRMS a los Parquet de `ml/data/interim/`.

Orden del método: limpiar → celdas-día → satélite de referencia → factor k → zonas → serie.
"""

from __future__ import annotations

import geopandas as gpd
import pandas as pd

from kindra.config import BOUNDARIES, FIRST_DAY, INTERIM, RAW, SCOPES
from kindra.live_paths import write_json
from kindra.pipeline import aggregate, clean, grid, harmonize, reference, zones

REGION_SCOPE = "ca"  # alcance de grilla fina; sus zonas son California y sus condados
REGION_ZONE_ID = "us-ca"  # zona provincia; los condados son `us-ca-<condado>`


def build(last_day: str | None = None) -> None:
    """Corre el pipeline completo y guarda las tablas en Parquet.

    Escribe `cell_days_{alcance}`, `cell_zones_{alcance}`, `zones`, `monthly_series`,
    `cells_monthly` y `factors` en `ml/data/interim/`, más `zones.json` para la exportación.

    Args:
        last_day: Último día a usar, `YYYY-MM-DD`. Si falta, el último día que tienen los CSV:
            así la serie no se alarga con meses en cero que en realidad no se descargaron.
    """
    fires = clean.clean(clean.load_fires(RAW, FIRST_DAY, last_day or "2100-01-01"))
    last_day = last_day or fires["day"].max().strftime("%Y-%m-%d")
    all_zones = zones.load_zones(BOUNDARIES)
    first, last = FIRST_DAY[:7], last_day[:7]

    INTERIM.mkdir(parents=True, exist_ok=True)
    series, cells, factors = [], [], []
    for scope in SCOPES:
        days = scope_cell_days(fires, scope)
        scope_factors = harmonize.region_factors(days, scope)
        weighted = harmonize.weights(days[days["is_reference"]], scope_factors)
        days = days.merge(weighted[["sat", "i", "j", "day", "w", "w_lo", "w_hi"]],
                          on=["sat", "i", "j", "day"], how="left")
        # validate, train y predict reutilizan estas tablas sin volver a leer los CSV.
        days.to_parquet(INTERIM / f"cell_days_{scope}.parquet", index=False)
        cells.append(aggregate.monthly_cells(days[days["is_reference"]]))
        factors.append(scope_factors)

        scope_zones = zones_for(scope, all_zones)
        if scope_zones.empty:
            continue  # "world" no tiene zonas propias: solo sirve para el mapa grueso
        cell_list = days[["scope", "i", "j", "clat", "clon"]].drop_duplicates()
        membership = zones.cell_zones(cell_list, scope_zones)
        membership.to_parquet(INTERIM / f"cell_zones_{scope}.parquet", index=False)
        zone_days = days.merge(membership, on=["scope", "i", "j"])
        series.append(aggregate.monthly_series(zone_days, first, last, open_month=open_month(last_day)))

    zones.save_zones(all_zones, INTERIM / "zones.parquet")
    pd.concat(series).to_parquet(INTERIM / "monthly_series.parquet", index=False)
    pd.concat(cells).to_parquet(INTERIM / "cells_monthly.parquet", index=False)
    pd.concat(factors).to_parquet(INTERIM / "factors.parquet", index=False)
    write_json(INTERIM / "zones.json", zones.zone_records(all_zones))
    write_json(INTERIM / "period.json", {"first": first, "last": last, "lastDay": last_day})


def scope_cell_days(fires: pd.DataFrame, scope: str) -> pd.DataFrame:
    """Celdas-día de un alcance (California en 0,1° o el mundo en 0,5°), con la referencia marcada."""
    settings = SCOPES[scope]
    days = grid.to_cell_days(clean.inside(fires, settings["bbox"]), settings["res"])
    return reference.mark_reference(days).assign(scope=scope, region=scope)


def zones_for(scope: str, all_zones: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """California y sus condados usan la grilla fina; el resto, la gruesa. Ninguna zona cuenta doble."""
    in_region = (all_zones["id"] == REGION_ZONE_ID) | (all_zones["parent"] == REGION_ZONE_ID)
    return all_zones[in_region if scope == REGION_SCOPE else ~in_region]


def open_month(last_day: str) -> str | None:
    """Mes `YYYY-MM` que sigue abierto (sale `partial`), o `None` si `last_day` es fin de mes."""
    day = pd.Timestamp(last_day)
    return None if day.is_month_end else day.strftime("%Y-%m")
