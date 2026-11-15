"""Serie mensual por zona y celdas por mes, con la forma de los contratos de `web/data/`."""

from __future__ import annotations

import pandas as pd

from kindra.config import MODIS_SATELLITES, SOURCE_CODE, VIIRS_SATELLITES, VIIRS_START
from kindra.pipeline.reference import reference_satellite

COUNT_COLUMNS = ["raw", "harm", "lo", "hi", "modis", "viirs"]


def monthly_series(zone_days: pd.DataFrame, first: str, last: str, open_month: str) -> pd.DataFrame:
    """Serie mensual de cada zona.

    Args:
        zone_days: Celdas-día con `zone_id`, `sat`, `day`, `nrt`, `is_reference` y, en las de
            referencia, los pesos `w`, `w_lo` y `w_hi` de `harmonize.weights`.
        first: Primer mes, `YYYY-MM`.
        last: Último mes, `YYYY-MM`.
        open_month: Mes en curso; sale con `partial = True`.

    Returns:
        Una fila por zona y mes, sin huecos, con `zone_id`, `t`, `raw` (suma directa de todos los
        satélites), `harm` (serie armonizada en escala MODIS), `lo` y `hi` (su intervalo), `modis`
        y `viirs` (celdas-día del satélite de la tarde de cada sensor), `src` y `partial`.
    """
    days = afternoon_flags(zone_days).assign(t=zone_days["day"].dt.strftime("%Y-%m"))
    keys = ["zone_id", "t"]
    reference = days[days["is_reference"]]
    afternoon_modis = days[days["sat"].isin(MODIS_SATELLITES) & days["is_afternoon_modis"]]
    afternoon_viirs = days[days["sat"].isin(VIIRS_SATELLITES) & days["is_afternoon_viirs"]]

    table = pd.concat([
        days.groupby(keys).size().rename("raw"),
        reference.groupby(keys)[["w", "w_lo", "w_hi"]].sum().set_axis(["harm", "lo", "hi"], axis=1),
        afternoon_modis.groupby(keys).size().rename("modis"),
        afternoon_viirs.groupby(keys).size().rename("viirs"),
        days.groupby(keys)["nrt"].any().rename("nrt"),
    ], axis=1)

    grid = pd.MultiIndex.from_product([zone_days["zone_id"].unique(), all_months(first, last)], names=keys)
    table = table.reindex(grid).reset_index()
    table[COUNT_COLUMNS] = table[COUNT_COLUMNS].fillna(0)
    table["viirs"] = table["viirs"].astype(object).where(table["t"] >= VIIRS_START, None)  # VIIRS no existía
    table["src"] = month_source(table["t"])
    table["partial"] = table["nrt"].fillna(False).astype(bool) | (table["t"] == open_month)
    return table.drop(columns="nrt")


def monthly_cells(reference_days: pd.DataFrame) -> pd.DataFrame:
    """Celdas con fuego por mes para el mapa: celdas-día de referencia y FRP máximo (MW).

    Returns:
        Una fila por alcance, mes y celda con `scope`, `t`, `clat`, `clon`, `cell_days` y `frp_max`.
    """
    days = reference_days.assign(t=reference_days["day"].dt.strftime("%Y-%m"))
    return (days.groupby(["scope", "t", "clat", "clon"], as_index=False)
                .agg(cell_days=("day", "nunique"), frp_max=("frp_max", "max")))


def all_months(first: str, last: str) -> pd.Index:
    """Todos los meses `YYYY-MM` de `first` a `last`, para que el calendario no tenga huecos."""
    return pd.period_range(first, last, freq="M").astype(str)


def month_source(months: pd.Series) -> pd.Series:
    """Código del satélite de referencia del último día de cada mes, por ejemplo `VIIRS_SNPP`."""
    last_days = pd.PeriodIndex(months, freq="M").to_timestamp(how="end").normalize()
    return reference_satellite(pd.Series(last_days, index=months.index)).map(SOURCE_CODE)


def afternoon_flags(cell_days: pd.DataFrame) -> pd.DataFrame:
    """Marca el MODIS y el VIIRS de la tarde de cada fecha, para las columnas `modis` y `viirs`.

    MODIS de la tarde es Terra hasta que llega Aqua y después Aqua. VIIRS es Suomi NPP y, desde el
    cambio de referencia, NOAA-20.
    """
    reference = reference_satellite(cell_days["day"])
    modis = reference.where(reference.isin(MODIS_SATELLITES), "Aqua")
    viirs = reference.where(reference.isin(VIIRS_SATELLITES), "SNPP")
    return cell_days.assign(is_afternoon_modis=cell_days["sat"] == modis,
                            is_afternoon_viirs=cell_days["sat"] == viirs)
