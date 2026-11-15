"""Focos de calor casi en tiempo real de NASA FIRMS alrededor de una detección.

Es la segunda opinión del agente: una anomalía de color sola no confirma un incendio, pero sí si
un satélite vio un foco cerca en las últimas horas (`rules.limit_decision`).

Usa la API de área: `/api/area/csv/{MAP_KEY}/{fuente}/{oeste,sur,este,norte}/{días}`, que pide
`FIRMS_MAP_KEY` en `ml/.env`.
"""

from __future__ import annotations

import io
import os
from datetime import datetime, timezone

import pandas as pd
import requests

from kindra.contracts import FirmsHotspot, FirmsMatch
from kindra.geo import bbox_around, distance_m

URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{area}/{days}"
# VIIRS primero por su resolución (375 m). S-NPP dejó de publicar NRT el 2026-11-02 (FIRMS,
# data_availability), así que ya no se pide.
SOURCES = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"]
RADIUS_KM = 10  # km alrededor de la detección
MAX_HOURS = 24  # horas hacia atrás
DAYS = 2  # FIRMS cuenta días UTC completos: con 2 se cubren las últimas 24 h aunque cruce la medianoche
TIMEOUT_S = 60


class FirmsError(RuntimeError):
    """FIRMS no respondió en ninguna fuente o la clave no sirve."""


def nearest_hotspot(position: tuple[float, float], now: datetime | None = None) -> FirmsMatch:
    """El foco más cercano a `(lon, lat)` de las últimas 24 h y a menos de 10 km.

    Una fuente que falla se salta; si fallan todas, no se puede decir "no hay focos".

    Raises:
        FirmsError: Si falta la clave o ninguna fuente respondió.
    """
    key = os.environ.get("FIRMS_MAP_KEY")
    if not key:
        raise FirmsError("Falta FIRMS_MAP_KEY en ml/.env")
    west, south, east, north = bbox_around(position, RADIUS_KM)
    area = f"{west:.4f},{south:.4f},{east:.4f},{north:.4f}"

    tables, errors = [], []
    for source in SOURCES:
        try:
            tables.append(hotspots(key, source, area))
        except (requests.RequestException, ValueError) as error:
            errors.append(f"{source}: {error}")
    if not tables:
        raise FirmsError("Ninguna fuente de FIRMS respondió: " + "; ".join(errors))
    return nearest_match(pd.concat(tables, ignore_index=True), position, now or datetime.now(timezone.utc))


def nearest_match(hotspots_df: pd.DataFrame, position: tuple[float, float], now: datetime) -> FirmsMatch:
    """El foco más cercano dentro del radio y de las últimas horas, o `found=False`.

    Args:
        hotspots_df: Filas de FIRMS con `latitude`, `longitude`, `acq_date`, `acq_time` y `source`.
        position: `(lon, lat)` de la detección.
        now: Momento de la consulta, con zona horaria.
    """
    if hotspots_df.empty:
        return FirmsMatch(found=False)
    df = hotspots_df.assign(
        hours_ago=(now - acquired_at(hotspots_df)).dt.total_seconds() / 3600,
        km=[distance_m(position, (lon, lat)) / 1000
            for lon, lat in zip(hotspots_df["longitude"], hotspots_df["latitude"])],
    )
    df = df[df["hours_ago"].between(0, MAX_HOURS) & (df["km"] <= RADIUS_KM)]
    if df.empty:
        return FirmsMatch(found=False)
    best = df.loc[df["km"].idxmin()]
    return FirmsMatch(found=True, nearest_km=round(float(best["km"]), 1),
                      hours_ago=round(float(best["hours_ago"])), source=str(best["source"]))


def hotspot_points(hotspots_df: pd.DataFrame, position: tuple[float, float]) -> list[FirmsHotspot]:
    """Los focos como puntos para el mapa de la app, del más cercano a la cámara al más lejano.

    El sensor sale del nombre de la fuente: todo lo que no empieza con "MODIS" es VIIRS.
    """
    points = [
        FirmsHotspot(
            position=(round(float(row.longitude), 5), round(float(row.latitude), 5)),
            sensor="MODIS" if str(row.source).upper().startswith("MODIS") else "VIIRS",
            source=str(row.source),
            acquired_at=when.to_pydatetime(),
            frp=optional_frp(getattr(row, "frp", None)),
            confidence=str(getattr(row, "confidence", "")),
            distance_km=round(distance_m(position, (float(row.longitude), float(row.latitude))) / 1000, 2),
        )
        for row, when in zip(hotspots_df.itertuples(index=False), acquired_at(hotspots_df))
    ]
    return sorted(points, key=lambda point: point.distance_km)


def optional_frp(value) -> float | None:
    """FRP en MW con un decimal, o `None` si la fila no lo trae."""
    return None if value is None or pd.isna(value) else round(float(value), 1)


def hotspots(key: str, source: str, area: str) -> pd.DataFrame:
    """Focos de una fuente en el recuadro, de los últimos `DAYS` días.

    Raises:
        requests.HTTPError: Si FIRMS responde con error.
        ValueError: Si la respuesta no es el CSV esperado (por ejemplo "Invalid MAP_KEY").
    """
    response = requests.get(URL.format(key=key, source=source, area=area, days=DAYS), timeout=TIMEOUT_S)
    response.raise_for_status()
    if not response.text.startswith("latitude"):
        raise ValueError(f"FIRMS no devolvió un CSV: {response.text[:80]!r}")
    return pd.read_csv(io.StringIO(response.text)).assign(source=source)


def acquired_at(df: pd.DataFrame) -> pd.Series:
    """`acq_date` + `acq_time` (HHMM en UTC; FIRMS quita los ceros de adelante) → fecha y hora UTC."""
    hhmm = df["acq_time"].astype(int).astype(str).str.zfill(4)
    return pd.to_datetime(df["acq_date"].astype(str) + " " + hhmm, format="%Y-%m-%d %H%M", utc=True)
