"""Cuentas geográficas chicas. Las posiciones van en `(lon, lat)`, como en los contratos."""

from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_M = 6_371_000  # radio medio de la Tierra, en metros
KM_PER_DEGREE_LAT = 111.32  # km por grado de latitud (casi constante en todo el planeta)


def distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Distancia en metros sobre la superficie de la Tierra, con la fórmula de haversine."""
    lon1, lat1, lon2, lat2 = map(radians, (*a, *b))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(h))


def bbox_around(position: tuple[float, float], radius_km: float) -> tuple[float, float, float, float]:
    """Recuadro `(oeste, sur, este, norte)` que contiene un círculo de `radius_km` alrededor del punto.

    Un grado de longitud se achica hacia los polos (por el coseno de la latitud); el `max` evita
    dividir por cero cerca de ellos.
    """
    lon, lat = position
    dlat = radius_km / KM_PER_DEGREE_LAT
    dlon = radius_km / (KM_PER_DEGREE_LAT * max(cos(radians(lat)), 0.01))
    return lon - dlon, lat - dlat, lon + dlon, lat + dlat
