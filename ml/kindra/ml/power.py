"""Cliente de NASA POWER: meteorología diaria por punto para el modelo de próximas 24 h.

POWER entrega la meteorología de MERRA-2 en una grilla de 0,5° de latitud × 0,625° de longitud.
Por eso cada punto se ajusta al centro de su celda POWER antes de pedirlo: varias celdas de
fuego de 0,1° comparten un solo pedido y una sola entrada en la caché.
"""

from __future__ import annotations

import time
from collections.abc import Sequence
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import requests

try:
    from kindra.config import INTERIM
except ModuleNotFoundError:  # TODO(Datos): quitar cuando exista kindra/config.py
    INTERIM = Path(__file__).resolve().parents[2] / "data" / "interim"

URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMETERS = {"WS10M": "ws10m", "WD10M": "wd10m", "T2M": "t2m", "RH2M": "rh2m"}
FILL_VALUE = -999.0  # valor que POWER usa para "sin dato"
LAT_STEP, LON_STEP = 0.5, 0.625  # grados; grilla de meteorología de POWER (MERRA-2)
CACHE = INTERIM / "power"

TIMEOUT_S = 120  # segundos por pedido
RETRY_BASE_S = 5  # segundos de espera antes del primer reintento; se duplica en cada uno


def snap(lat, lon):
    """Devuelve el centro de la celda POWER que contiene el punto.

    Acepta números sueltos o columnas de pandas, para ajustar muchas celdas de una vez.
    """
    return _snap_axis(lat, LAT_STEP), _snap_axis(lon, LON_STEP)


def _snap_axis(value, step: float):
    # floor(x + 0,5) desempata siempre hacia arriba: los centros de la grilla de 0,1° caen justo
    # entre dos celdas POWER y np.round los repartiría hacia el par. Se redondea a 3 decimales
    # para que el nombre del archivo de caché sea siempre el mismo.
    return np.round(np.floor(value / step + 0.5) * step, 3)


def parse(payload: dict) -> pd.DataFrame:
    """Convierte la respuesta JSON de POWER en una fila por día.

    Args:
        payload: Respuesta de `/temporal/daily/point` en formato JSON.

    Returns:
        Columnas `date`, `ws10m` (m/s), `wd10m` (grados), `t2m` (°C) y `rh2m` (%).
        Los días sin dato quedan en `NaN`.
    """
    values = payload["properties"]["parameter"]
    df = pd.DataFrame({PARAMETERS[k]: pd.Series(v, dtype=float) for k, v in values.items()})
    df = df.replace(FILL_VALUE, np.nan)
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    return df.rename_axis("date").reset_index()[["date", *PARAMETERS.values()]]


def daily(lat: float, lon: float, start: str, end: str, attempts: int = 4) -> pd.DataFrame:
    """Pide a POWER la meteorología diaria de un punto, con reintentos.

    Args:
        lat: Latitud en grados.
        lon: Longitud en grados.
        start: Primer día, `YYYY-MM-DD`.
        end: Último día, `YYYY-MM-DD`.
        attempts: Intentos en total ante límite de pedidos (429), errores del servidor (5xx),
            cortes de red o tiempo de espera agotado.

    Raises:
        ValueError: Si `attempts` es menor que 1.
        requests.HTTPError: Si POWER rechaza el pedido o sigue respondiendo 429/5xx tras todos
            los intentos.
        requests.ConnectionError: Si la red sigue fallando tras todos los intentos.
        requests.Timeout: Si POWER sigue sin responder tras todos los intentos.
    """
    if attempts < 1:
        raise ValueError("attempts debe ser al menos 1")

    params = {
        "parameters": ",".join(PARAMETERS),
        "community": "AG",
        "latitude": lat,
        "longitude": lon,
        "start": start.replace("-", ""),  # POWER pide las fechas como YYYYMMDD
        "end": end.replace("-", ""),
        "format": "JSON",
        "time-standard": "UTC",
    }
    last_error: requests.RequestException | None = None
    for attempt in range(attempts):
        if attempt > 0:
            time.sleep(RETRY_BASE_S * 2 ** (attempt - 1))  # 5, 10, 20 s
        try:
            response = requests.get(URL, params=params, timeout=TIMEOUT_S)
        except (requests.ConnectionError, requests.Timeout) as error:
            last_error = error
            continue
        if response.status_code == 429 or response.status_code >= 500:
            last_error = requests.HTTPError(
                f"POWER respondió {response.status_code} en los {attempts} intentos",
                response=response,
            )
            continue
        response.raise_for_status()
        return parse(response.json())

    raise last_error


def daily_cached(lat: float, lon: float, year: int) -> pd.DataFrame:
    """Devuelve un año de meteorología de la celda POWER del punto, usando la caché en Parquet.

    El año en curso no se guarda en la caché, porque POWER todavía puede agregarle días.
    """
    plat, plon = snap(lat, lon)
    path = CACHE / f"{plat}_{plon}_{year}.parquet"
    if path.exists():
        return pd.read_parquet(path)

    today = pd.Timestamp.now(tz="UTC").date()
    first_day = date(year, 1, 1)
    last_day = min(date(year, 12, 31), today)
    df = daily(plat, plon, first_day.isoformat(), last_day.isoformat())
    df = df.assign(plat=plat, plon=plon)

    if year < today.year:
        path.parent.mkdir(parents=True, exist_ok=True)
        df.to_parquet(path, index=False)
    return df


def weather_for_cells(cells: pd.DataFrame, years: Sequence[int]) -> pd.DataFrame:
    """Devuelve la meteorología diaria de cada celda de fuego, por año.

    Args:
        cells: Una fila por celda con columnas `clat` y `clon` (centro de la celda, grados).
        years: Años a pedir, por ejemplo `range(2012, 2026)`.

    Returns:
        Una fila por celda y día con `clat`, `clon`, `date`, `ws10m`, `wd10m`, `t2m` y `rh2m`.
    """
    cells = cells[["clat", "clon"]].drop_duplicates()
    plat, plon = snap(cells["clat"], cells["clon"])
    cells = cells.assign(plat=plat, plon=plon)

    points = cells[["plat", "plon"]].drop_duplicates()
    weather = pd.concat(
        [daily_cached(p.plat, p.plon, year) for p in points.itertuples() for year in years],
        ignore_index=True,
    )
    return cells.merge(weather, on=["plat", "plon"]).drop(columns=["plat", "plon"])