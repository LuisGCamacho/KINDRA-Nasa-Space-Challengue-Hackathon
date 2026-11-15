"""Factor mensual VIIRS → MODIS y peso de cada celda-día (AGENTS.md, método 3).

`k = celdas-día Aqua / celdas-día VIIRS`, por región, satélite VIIRS y mes del año, calibrado en
2012–2021 (después, Terra y Aqua derivaron de órbita). MODIS pesa 1 y VIIRS pesa `k`: así la serie
queda en escala MODIS. El intervalo (bootstrap por años) es el de `kindra/ml/calibration.py`.
"""

from __future__ import annotations

import pandas as pd

from kindra.config import CALIBRATION_YEARS, MODIS_SATELLITES, VIIRS_SATELLITES
from kindra.ml.calibration import monthly_factors

FACTOR_COLUMNS = ["region", "sat", "month", "k", "k_low", "k_high", "n_years"]


def pair_counts(cell_days: pd.DataFrame, viirs: str) -> pd.DataFrame:
    """Celdas-día de Aqua (`a`) y de un VIIRS (`v`) por año y mes, con la forma de `calibration.py`.

    Args:
        cell_days: Salida de `grid.to_cell_days` (una fila por satélite, celda y día).
        viirs: Satélite VIIRS a comparar con Aqua: `SNPP` o `NOAA20`.
    """
    pair = cell_days[cell_days["sat"].isin(["Aqua", viirs])]
    return (pd.crosstab([pair["day"].dt.year.rename("year"), pair["day"].dt.month.rename("month")],
                        pair["sat"])
              .reindex(columns=["Aqua", viirs], fill_value=0)
              .set_axis(["a", "v"], axis=1)
              .reset_index())


def region_factors(cell_days: pd.DataFrame, region: str) -> pd.DataFrame:
    """Factores de una región para cada VIIRS que voló junto a Aqua en los años de calibración.

    Cada VIIRS usa solo los años en que ya volaba: NOAA-20 empieza en 2018, así que su factor sale
    de 2018–2021 y el de Suomi NPP de 2012–2021.

    Returns:
        Una fila por satélite VIIRS y mes con `region`, `sat`, `month`, `k`, `k_low`, `k_high` y
        `n_years`. Vacía si ningún VIIRS coincide con los años de calibración.
    """
    tables = []
    for viirs in VIIRS_SATELLITES:
        counts = pair_counts(cell_days, viirs)
        flown = counts.groupby("year")["v"].transform("sum") > 0
        calibration = counts[counts["year"].isin(list(CALIBRATION_YEARS)) & flown]
        if calibration.empty:
            continue
        tables.append(monthly_factors(calibration, CALIBRATION_YEARS).assign(region=region, sat=viirs))
    if not tables:
        return pd.DataFrame(columns=FACTOR_COLUMNS)
    return pd.concat(tables, ignore_index=True)[FACTOR_COLUMNS]


def weights(reference_days: pd.DataFrame, factors: pd.DataFrame) -> pd.DataFrame:
    """Peso de cada celda-día de referencia en la escala MODIS.

    MODIS vale 1. VIIRS vale el `k` de su región, satélite y mes; `w_lo` y `w_hi` usan los bordes
    del intervalo.

    Args:
        reference_days: Celdas-día de referencia con `region`, `sat` y `day`.
        factors: Salida de `region_factors` para todas las regiones.

    Raises:
        ValueError: Si a una celda-día VIIRS le falta su factor. Es un error a propósito: un
            factor que falta no se reemplaza por cero, porque borraría ese fuego de la serie.
    """
    days = reference_days.assign(month=reference_days["day"].dt.month)
    days = days.merge(factors[["region", "sat", "month", "k", "k_low", "k_high"]],
                      on=["region", "sat", "month"], how="left")
    is_modis = days["sat"].isin(MODIS_SATELLITES)
    missing = ~is_modis & days["k"].isna()
    if missing.any():
        keys = days.loc[missing, ["region", "sat", "month"]].drop_duplicates().values.tolist()
        raise ValueError(f"Faltan factores para {keys}")
    return days.assign(
        w=days["k"].where(~is_modis, 1.0),
        w_lo=days["k_low"].where(~is_modis, 1.0),
        w_hi=days["k_high"].where(~is_modis, 1.0),
    ).drop(columns=["month", "k", "k_low", "k_high"])
