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
STATIC_TYPE = "2"  # `type` de FIRMS para fuentes fijas en tierra: refinerías, plantas, volcanes
# Decimales al comparar con las fuentes fijas: 0,01° (~1 km) cubre el corrimiento de un píxel
# VIIRS de 375 m entre pasadas sin tapar el campo de alrededor.
STATIC_DECIMALS = 2
STATIC_SOURCES_FILE = "static_sources.parquet"  # en INTERIM; lo escribe `build` y lo lee el agente


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

    Los focos NRT no traen `type`, así que también se descartan los que caen sobre una fuente
    fija que FIRMS ya marcó en el dato definitivo (`on_static_source`).

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
    kept = kept.loc[~(kept["nrt"] & on_static_source(kept["lat"], kept["lon"], static_points(fires)))]
    return kept[CLEAN_COLUMNS].reset_index(drop=True)


def static_points(fires: pd.DataFrame) -> pd.DataFrame:
    """Posiciones de las fuentes fijas (`type = 2`) del dato definitivo, redondeadas a 0,01°.

    `build` las guarda en `interim/static_sources.parquet` para que el agente también las salte.
    """
    static = fires.loc[fires["type"].astype(str) == STATIC_TYPE, ["lat", "lon"]].round(STATIC_DECIMALS)
    return static.drop_duplicates().reset_index(drop=True)


def on_static_source(lat: pd.Series, lon: pd.Series, points: pd.DataFrame) -> pd.Series:
    """Indica qué focos caen sobre una fuente fija ya conocida (`static_points`).

    Sin este filtro, el NRT contaba como incendio el calor de refinerías y plantas: en Los
    Ángeles, enero a julio de 2026, 1291 de los 1617 focos VIIRS definitivos eran fuentes fijas, y
    agosto (ya NRT) saltaba de 23 a 145 celdas-día con MODIS quieto en 3.

    Args:
        lat: Latitud de cada foco, en grados.
        lon: Longitud de cada foco, con el mismo índice que `lat`.
        points: Salida de `static_points`.

    Returns:
        Serie booleana con el índice de `lat`.
    """
    known = set(zip(points["lat"], points["lon"]))
    keys = zip(lat.round(STATIC_DECIMALS), lon.round(STATIC_DECIMALS))
    return pd.Series([key in known for key in keys], index=lat.index, dtype=bool)


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
