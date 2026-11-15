"""Variables del modelo de próximas 24 h: una fila por celda de California (0,1°) y día.

Solo entran las celdas con fuego en los últimos 7 días: el modelo responde "¿sigue o se extiende
el fuego que ya hay?". No predice igniciones nuevas en celdas sin focos, y la pantalla lo dice.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from kindra.config import SCOPES
from kindra.pipeline.grid import cell_center

FEATURES = ["fires_1d", "fires_3d", "fires_7d", "neigh_3d", "downwind_3d",
            "ws10m", "wd_sin", "wd_cos", "t2m", "rh2m", "month_sin", "month_cos"]
TARGET = "fire_tomorrow"  # 1 si la celda tiene al menos una celda-día de referencia al día siguiente
WINDOW_DAYS = 7  # historia propia de la celda
NEIGHBOR_DAYS = 3  # historia de las vecinas
OFFSETS = [(di, dj) for di in (-1, 0, 1) for dj in (-1, 0, 1) if (di, dj) != (0, 0)]  # las 8 vecinas
KEYS = ["i", "j", "day"]


def build_features(reference_days: pd.DataFrame, weather: pd.DataFrame) -> pd.DataFrame:
    """Arma la tabla del modelo.

    Args:
        reference_days: Celdas-día de referencia de California con `i`, `j` y `day`.
        weather: Salida de `power.weather_for_cells`, con `clat`, `clon`, `date` y las variables.

    Returns:
        Una fila por celda candidata y día con `i`, `j`, `day`, `clat`, `clon`, `FEATURES` y `TARGET`.
    """
    res = SCOPES["ca"]["res"]
    fires = fire_days(reference_days)
    rows = own_history(fires)
    rows = rows.assign(clat=cell_center(rows["i"], res), clon=cell_center(rows["j"], res))

    neighbors = neighbor_history(fires)
    rows = rows.merge(neighbors.groupby(KEYS)["n"].sum().rename("neigh_3d").reset_index(), on=KEYS, how="left")

    rows = rows.merge(weather.rename(columns={"date": "day"}), on=["clat", "clon", "day"], how="left")
    rows["di"], rows["dj"] = upwind_offset(rows["wd10m"].fillna(0))
    rows = rows.merge(neighbors.rename(columns={"n": "downwind_3d"}), on=[*KEYS, "di", "dj"], how="left")

    # El objetivo de cada fila es si la celda tuvo fuego al día siguiente.
    tomorrow = fires.assign(day=fires["day"] - pd.Timedelta(days=1), **{TARGET: 1})
    rows = rows.merge(tomorrow, on=KEYS, how="left")

    # Ángulos y meses como seno y coseno: así 359° queda cerca de 1° y diciembre cerca de enero.
    radians = np.deg2rad(rows["wd10m"])
    month = rows["day"].dt.month
    rows = rows.assign(
        wd_sin=np.sin(radians), wd_cos=np.cos(radians),
        month_sin=np.sin(2 * np.pi * month / 12), month_cos=np.cos(2 * np.pi * month / 12),
    )
    counts = ["neigh_3d", "downwind_3d", TARGET]
    rows[counts] = rows[counts].fillna(0).astype(int)
    return rows[["i", "j", "day", "clat", "clon", *FEATURES, TARGET]]


def fire_days(reference_days: pd.DataFrame) -> pd.DataFrame:
    """Celdas con fuego por día, sin repetir: columnas `i`, `j` y `day`."""
    return reference_days[KEYS].drop_duplicates().reset_index(drop=True)


def own_history(fires: pd.DataFrame) -> pd.DataFrame:
    """Días con fuego de la propia celda en 1, 3 y 7 días hasta `day` incluido.

    Cada día con fuego se copia a los 7 días siguientes; así cada fila resultante es una celda
    candidata, con fuego en algún momento de su última semana.
    """
    lagged = pd.concat([fires.assign(day=fires["day"] + pd.Timedelta(days=lag), lag=lag)
                        for lag in range(WINDOW_DAYS)])
    lagged = lagged.assign(d1=lagged["lag"] == 0, d3=lagged["lag"] < 3)
    counts = lagged.groupby(KEYS).agg(fires_1d=("d1", "sum"), fires_3d=("d3", "sum"), fires_7d=("lag", "size"))
    return counts.reset_index()


def neighbor_history(fires: pd.DataFrame) -> pd.DataFrame:
    """Días con fuego en cada una de las 8 celdas vecinas en los últimos 3 días.

    Returns:
        Una fila por celda, día y vecina con `di`, `dj` (posición de la vecina) y `n`.
    """
    copies = [fires.assign(i=fires["i"] - di, j=fires["j"] - dj, day=fires["day"] + pd.Timedelta(days=lag),
                           di=di, dj=dj)
              for di, dj in OFFSETS for lag in range(NEIGHBOR_DAYS)]
    return pd.concat(copies).groupby([*KEYS, "di", "dj"]).size().rename("n").reset_index()


def upwind_offset(wind_from_degrees: pd.Series) -> tuple[pd.Series, pd.Series]:
    """Vecina desde donde sopla el viento, como `(di, dj)`.

    WD10M de NASA POWER es la dirección de origen: 0° = norte (`di = +1`), 90° = este (`dj = +1`).
    """
    radians = np.deg2rad(wind_from_degrees)
    return np.round(np.cos(radians)).astype(int), np.round(np.sin(radians)).astype(int)
