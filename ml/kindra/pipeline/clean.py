"""Lectura y limpieza de los CSV de FIRMS para el pipeline.

Aplica las mismas reglas que la calibración (`kindra/ml/calibration.py`: satélites, confianza y
solo vegetación) y además conserva el FRP y si el foco vino de un archivo NRT, que es provisional:
FIRMS lo reemplaza por el dato definitivo meses después.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from kindra.config import MODIS_MIN_CONFIDENCE, NRT_FOLDER
from kindra.ml.calibration import SATELLITES, counts_for_method, load_firms

CLEAN_COLUMNS = ["lat", "lon", "day", "sat", "frp", "nrt"]


def load_fires(raw: Path, first_day: str, last_day: str) -> pd.DataFrame:
    """Lee todos los CSV de `raw` y sus subcarpetas (anuales y NRT) en una sola tabla.

    Args:
        raw: Carpeta con los CSV (`ml/data/raw/`).
        first_day: Primer día a leer, `YYYY-MM-DD`.
        last_day: Último día a leer, `YYYY-MM-DD`.

    Returns:
        Una fila por foco con las columnas de `calibration.load_firms`, incluidos `frp` y `file`.

    Raises:
        FileNotFoundError: Si `raw` no tiene ningún CSV.
    """
    return load_firms(raw, first_day, last_day)


def clean(fires: pd.DataFrame) -> pd.DataFrame:
    """Deja los focos que cuentan para el método y les pone el nombre corto del satélite.

    Los focos de un satélite que `SATELLITES` no reconoce se descartan; el cuaderno
    `02_calibracion` los lista con `calibration.unknown_satellites` para agregarlos.

    Args:
        fires: Salida de `load_fires`.

    Returns:
        Columnas `lat`, `lon`, `day`, `sat` (`Terra`, `Aqua`, `SNPP`, `NOAA20`…), `frp` (MW) y
        `nrt` (`True` si vino de `raw/nrt/`).
    """
    kept = fires.loc[counts_for_method(fires, MODIS_MIN_CONFIDENCE)].copy()
    kept["sat"] = kept["satellite"].map(SATELLITES)
    kept["nrt"] = came_from_nrt(kept["file"])
    kept = kept.dropna(subset=["sat"])
    return kept[CLEAN_COLUMNS].reset_index(drop=True)


def inside(fires: pd.DataFrame, bbox: tuple[float, float, float, float]) -> pd.DataFrame:
    """Filtra los focos dentro del recuadro `(oeste, sur, este, norte)`, en grados."""
    west, south, east, north = bbox
    mask = fires["lon"].between(west, east) & fires["lat"].between(south, north)
    return fires.loc[mask].reset_index(drop=True)


def came_from_nrt(files: pd.Series) -> pd.Series:
    """Indica qué focos vienen de la carpeta NRT, según la ruta de su CSV.

    Se normalizan las barras porque en Windows la ruta llega con `\\`.
    """
    return files.str.replace("\\", "/", regex=False).str.contains(f"/{NRT_FOLDER}/", regex=False)
