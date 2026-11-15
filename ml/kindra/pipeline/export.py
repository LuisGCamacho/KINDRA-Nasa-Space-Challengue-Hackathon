"""Escribe los JSON de `web/data/` con los contratos de AGENTS.md.

Son lo único que la app puede leer cuando no hay base de datos, así que la forma de cada archivo
tiene que coincidir con el contrato al pie de la letra (nombres, orden lat/lon, nulos).
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import pandas as pd

from kindra.config import CALIBRATION_YEARS
from kindra.live_paths import write_json

MAX_JSON_BYTES = 5_000_000  # AGENTS.md: cada JSON de web/data/ por debajo de ~5 MB


def series_payload(zone_id: str, months: pd.DataFrame) -> dict:
    """Contrato de `series/{zoneId}.json`: `{ zoneId, months: [{ t, raw, harm, lo, hi, ... }] }`.

    Args:
        zone_id: Id de la zona, por ejemplo `us-ca-shasta`.
        months: Filas de `aggregate.monthly_series` de esa zona.
    """
    rows = [{
        "t": row.t, "raw": count(row.raw), "harm": count(row.harm),
        "lo": count(row.lo), "hi": count(row.hi),
        "modis": count(row.modis), "viirs": count(row.viirs),
        "src": row.src, "partial": bool(row.partial),
    } for row in months.sort_values("t").itertuples()]
    return {"zoneId": zone_id, "months": rows}


def cells_payload(res: float, cells: pd.DataFrame) -> dict:
    """Contrato de `cells/{alcance}/{YYYY-MM}.json`: `{ res, cells: [[lat, lon, celdasDia, frpMax]] }`.

    Ojo: lat va antes que lon, al revés que en GeoJSON. Un mes sin fuego sale con `cells: []`.
    """
    rows = [[row.clat, row.clon, int(row.cell_days), round(float(row.frp_max), 1)]
            for row in cells.sort_values(["clat", "clon"]).itertuples()]
    return {"res": res, "cells": rows}


def factors_payload(factors: pd.DataFrame) -> dict:
    """Factores k para la pantalla Armonización.

    Contrato nuevo, todavía pendiente de aprobación del equipo: no está en AGENTS.md.
    """
    years = f"{CALIBRATION_YEARS.start}–{CALIBRATION_YEARS.stop - 1}"
    rows = [{
        "region": row.region, "sat": row.sat, "month": int(row.month),
        "k": round(float(row.k), 4), "kLow": round(float(row.k_low), 4),
        "kHigh": round(float(row.k_high), 4), "nYears": int(row.n_years),
    } for row in factors.sort_values(["region", "sat", "month"]).itertuples()]
    return {"calibration": years, "factors": rows}


def export_all(web_data: Path, zones: list[dict], series: pd.DataFrame, cells: pd.DataFrame,
               factors: pd.DataFrame, resolutions: dict[str, float], months: Iterable[str]) -> None:
    """Escribe `zones.json`, `series/`, `cells/{ca|world}/` y `factors.json`.

    Args:
        web_data: Carpeta `web/data/`.
        zones: Filas de `zones.zone_records`.
        series: Salida de `aggregate.monthly_series` con todas las zonas.
        cells: Salida de `aggregate.monthly_cells` con todos los alcances.
        factors: Salida de `harmonize.region_factors` con todas las regiones.
        resolutions: Grados por celda de cada alcance, por ejemplo `{"ca": 0.1}`.
        months: Todos los meses `YYYY-MM` del periodo. Se escribe un archivo por mes aunque no
            haya fuego, para que el mapa no pida un archivo que no existe.
    """
    write_checked(web_data / "zones.json", zones)
    for zone_id, zone_months in series.groupby("zone_id"):
        write_checked(web_data / "series" / f"{zone_id}.json", series_payload(zone_id, zone_months))
    export_cells(web_data, cells, resolutions, list(months))
    write_checked(web_data / "factors.json", factors_payload(factors))


def export_cells(web_data: Path, cells: pd.DataFrame, resolutions: dict[str, float],
                 months: list[str]) -> None:
    """Un archivo por alcance y mes; los meses sin celdas salen como `{ res, cells: [] }`."""
    by_month = dict(iter(cells.groupby(["scope", "t"])))
    empty = cells.iloc[0:0]
    for scope, res in resolutions.items():
        for month in months:
            month_cells = by_month.get((scope, month), empty)
            write_checked(web_data / "cells" / scope / f"{month}.json", cells_payload(res, month_cells))


def write_checked(path: Path, payload) -> None:
    """Escribe el JSON y avisa si pasa el tamaño acordado, sin cortar la exportación."""
    write_json(path, payload)
    size = path.stat().st_size
    if size > MAX_JSON_BYTES:
        print(f"Aviso: {path.name} pesa {size / 1e6:.1f} MB (límite acordado: 5 MB)")


def count(value) -> int | None:
    """Cuenta redondeada a entero; `None` (null en JSON) si no aplica, como VIIRS antes de 2012."""
    return None if value is None or pd.isna(value) else int(round(float(value)))
