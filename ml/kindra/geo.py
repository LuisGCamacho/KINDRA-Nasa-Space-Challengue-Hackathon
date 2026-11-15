"""Cuentas geográficas chicas. Las posiciones van en `(lon, lat)`, como en los contratos."""

from __future__ import annotations

from datetime import datetime, timezone
from math import asin, cos, degrees, radians, sin, sqrt

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


def sun_elevation_deg(position: tuple[float, float], when: datetime) -> float:
    """Altura del sol sobre el horizonte, en grados (negativa de noche). Error de ~1°, alcanza.

    Fórmula aproximada de la NOAA: declinación del sol según el día del año y ángulo horario según
    la hora solar del lugar. Sin la ecuación del tiempo (±16 min), que aquí no cambia nada.

    Args:
        position: `(lon, lat)` en grados.
        when: Momento con zona horaria; sin zona se toma como UTC.
    """
    lon, lat = position
    when = when.replace(tzinfo=timezone.utc) if when.tzinfo is None else when.astimezone(timezone.utc)
    day_angle = 2 * 3.141592653589793 * (when.timetuple().tm_yday - 1) / 365
    declination = 0.006918 - 0.399912 * cos(day_angle) + 0.070257 * sin(day_angle)         - 0.006758 * cos(2 * day_angle) + 0.000907 * sin(2 * day_angle)  # radianes
    solar_hours = when.hour + when.minute / 60 + lon / 15  # 15° de longitud = 1 hora
    hour_angle = radians(15 * (solar_hours - 12))
    lat_r = radians(lat)
    return degrees(asin(sin(lat_r) * sin(declination) + cos(lat_r) * cos(declination) * cos(hour_angle)))
