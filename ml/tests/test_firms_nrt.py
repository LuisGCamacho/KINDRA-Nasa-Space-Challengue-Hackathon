"""Pruebas de la búsqueda de focos FIRMS cercanos, sin internet."""

from datetime import datetime, timezone

import pandas as pd

from kindra.agent.firms_nrt import nearest_match

DETECTION = (-122.39, 40.59)  # Redding
NOW = datetime(2026, 11, 15, 20, 0, tzinfo=timezone.utc)


def hotspots(*rows):
    """Filas `(lon, lat, acq_date, acq_time, fuente)` con la forma del CSV de FIRMS."""
    return pd.DataFrame(rows, columns=["longitude", "latitude", "acq_date", "acq_time", "source"])


def test_se_queda_el_foco_mas_cercano():
    match = nearest_match(hotspots(
        (-122.39, 40.61, "2026-11-15", 945, "MODIS_NRT"),  # ~2,2 km, a las 09:45 UTC
        (-122.39, 40.65, "2026-11-15", 1030, "VIIRS_NOAA20_NRT"),  # ~6,7 km
    ), DETECTION, NOW)
    assert (match.found, match.nearest_km, match.hours_ago, match.source) == (True, 2.2, 10, "MODIS_NRT")


def test_focos_viejos_o_lejanos_no_cuentan():
    match = nearest_match(hotspots(
        (-122.39, 40.60, "2026-11-13", 2000, "MODIS_NRT"),  # hace 48 h
        (-122.39, 40.80, "2026-11-15", 1900, "VIIRS_NOAA20_NRT"),  # ~23 km
    ), DETECTION, NOW)
    assert match.found is False and match.nearest_km is None


def test_sin_focos_no_hay_coincidencia():
    assert nearest_match(hotspots(), DETECTION, NOW).found is False
