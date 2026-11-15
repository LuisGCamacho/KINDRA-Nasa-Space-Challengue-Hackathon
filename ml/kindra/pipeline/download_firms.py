"""`python -m kindra download`: CSV anuales de NASA FIRMS de la región y los últimos días por la API NRT.

FIRMS publica los archivos anuales por país, no por estado. Se baja el de `FIRMS_COUNTRY` y, al
guardarlo, se recortan los focos al recuadro `REGION_BBOX`: así el de Estados Unidos (~50 MB por
año en VIIRS) queda en unos pocos MB de California. Los archivos van a `ml/data/raw/<carpeta>/`
como `<carpeta>_<año>_<región>.csv`, con las mismas columnas que publica FIRMS.

Los días recientes (el año en curso todavía no tiene archivo anual) llegan por la API de área y
necesitan `FIRMS_MAP_KEY`.
"""

from __future__ import annotations

import csv
import io
import os
from datetime import date, timedelta
from pathlib import Path

import requests

from kindra.config import FIRMS_COUNTRY, NRT_FOLDER, RAW, REGION_BBOX, REGION_NAME

BASE = "https://firms.modaps.eosdis.nasa.gov"
TIMEOUT_S = 180  # segundos por pedido; un CSV anual de VIIRS de Estados Unidos pesa ~50 MB

# Carpeta de FIRMS por sensor y primer año con datos: MODIS Terra desde 2000, VIIRS S-NPP desde
# 2012 y NOAA-20 desde 2018 (los años que voló junto a Aqua sirven para su factor propio).
ARCHIVE_FIRST_YEAR = {"modis": 2000, "viirs-snpp": 2012, "viirs-jpss1": 2018}
# Último año con archivo anual. El 2026 respondía 404 al 2026-11-14: llega por la API NRT.
ARCHIVE_LAST_YEAR = 2025

NRT_SOURCES = ["MODIS_NRT", "VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"]
MAX_DAYS_PER_REQUEST = 5  # límite de la API de área de FIRMS (1 a 5 días por pedido)
CSV_HEADER_START = "latitude"  # primera columna de todo CSV de FIRMS


class FirmsDownloadError(RuntimeError):
    """FIRMS respondió, pero no con un CSV de focos."""


def yearly(last_year: int = ARCHIVE_LAST_YEAR) -> list[str]:
    """Baja los CSV anuales de la región que todavía no están en `RAW`.

    Un archivo ya bajado no se vuelve a pedir, así que cortar y volver a correr retoma donde quedó.

    Args:
        last_year: Último año a bajar.

    Returns:
        Los archivos que no se pudieron bajar, con el motivo. Lista vacía si se bajó todo.
    """
    failures = []
    for folder, first_year in ARCHIVE_FIRST_YEAR.items():
        for year in range(first_year, last_year + 1):
            name = archive_name(folder, year, REGION_NAME)
            if already_downloaded(name):
                continue
            try:
                save_csv(archive_url(folder, year), RAW / folder / name, crop_to=REGION_BBOX)
            except (requests.RequestException, FirmsDownloadError) as error:
                failures.append(f"{name}: {error}")
    return failures


def recent(days: int, today: date | None = None) -> None:
    """Baja los últimos `days` días de la región desde la API NRT, en pedidos de hasta 5 días.

    Los archivos van a `raw/nrt/` y el pipeline marca esos meses como provisionales (`partial`),
    porque FIRMS reemplaza los datos NRT por los definitivos meses después. La API ya filtra por
    `REGION_BBOX`, así que no hace falta recortar.

    Args:
        days: Cantidad de días hacia atrás, contando `today`.
        today: Último día a bajar. Por defecto, hoy.

    Raises:
        RuntimeError: Si falta `FIRMS_MAP_KEY` en el entorno o en `ml/.env`.
        requests.HTTPError: Si FIRMS rechaza un pedido (clave inválida o cuota agotada).
    """
    key = os.environ.get("FIRMS_MAP_KEY")
    if not key:
        raise RuntimeError("Falta FIRMS_MAP_KEY en ml/.env: sin ella no se pueden bajar los días NRT")

    area = ",".join(str(v) for v in REGION_BBOX)
    last_day = today or date.today()
    for first_day, length in day_chunks(last_day, days):
        for source in NRT_SOURCES:
            url = f"{BASE}/api/area/csv/{key}/{source}/{area}/{length}/{first_day.isoformat()}"
            save_csv(url, RAW / NRT_FOLDER / f"{source}_{first_day.isoformat()}.csv")


def archive_name(folder: str, year: int, region: str) -> str:
    """Nombre del CSV anual guardado: `viirs-snpp_2015_California.csv`."""
    return f"{folder}_{year}_{region}.csv"


def archive_url(folder: str, year: int) -> str:
    """URL pública del CSV anual de `FIRMS_COUNTRY`."""
    return f"{BASE}/data/country/{folder}/{year}/{folder}_{year}_{FIRMS_COUNTRY}.csv"


def already_downloaded(name: str) -> bool:
    """Indica si el archivo ya está en `RAW` o en cualquiera de sus subcarpetas.

    Se busca en todas las subcarpetas porque hay CSV bajados a mano fuera de la carpeta del sensor
    (por ejemplo en `raw/viirs/`), y la limpieza lee todo `RAW`: bajarlo otra vez duplicaría focos.
    """
    return any(RAW.rglob(name))


def day_chunks(last_day: date, days: int) -> list[tuple[date, int]]:
    """Parte los últimos `days` días en tramos `(primer día, largo)` de hasta 5 días."""
    chunks = []
    for offset in range(0, days, MAX_DAYS_PER_REQUEST):
        length = min(MAX_DAYS_PER_REQUEST, days - offset)
        chunks.append((last_day - timedelta(days=offset + length - 1), length))
    return chunks


def save_csv(url: str, target: Path, crop_to: tuple[float, float, float, float] | None = None) -> None:
    """Baja un CSV de FIRMS a `target`, sin dejar archivos a medias.

    Se escribe en un `.part` y se renombra al final: si la descarga se corta, el archivo no
    queda con su nombre final y la próxima corrida lo vuelve a pedir.

    Args:
        url: Dirección del CSV en FIRMS.
        target: Archivo de destino.
        crop_to: Recuadro `(oeste, sur, este, norte)` en grados. Si se pasa, solo se guardan los
            focos de adentro.

    Raises:
        requests.HTTPError: Si FIRMS responde con un error (por ejemplo, 404 si el año no existe).
        FirmsDownloadError: Si la respuesta no empieza como un CSV de FIRMS.
    """
    response = requests.get(url, timeout=TIMEOUT_S)
    response.raise_for_status()
    text = response.content.decode("utf-8").lstrip("﻿")  # algunos CSV traen BOM al inicio
    if not text.startswith(CSV_HEADER_START):
        raise FirmsDownloadError(f"la respuesta no es un CSV de FIRMS: {text[:80]!r}")
    if crop_to:
        text = crop_csv(text, crop_to)

    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(".part")
    partial.write_text(text, encoding="utf-8", newline="")
    partial.replace(target)


def crop_csv(text: str, bbox: tuple[float, float, float, float]) -> str:
    """Devuelve el CSV con el encabezado y solo los focos dentro de `bbox` (oeste, sur, este, norte)."""
    west, south, east, north = bbox
    rows = csv.reader(io.StringIO(text))
    header = next(rows)
    lat_col, lon_col = header.index("latitude"), header.index("longitude")

    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(header)
    for row in rows:
        if south <= float(row[lat_col]) <= north and west <= float(row[lon_col]) <= east:
            writer.writerow(row)
    return output.getvalue()
