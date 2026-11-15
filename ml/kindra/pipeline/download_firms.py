"""`python -m kindra download`: CSV anuales de NASA FIRMS de la región y el año en curso por la API de área.

FIRMS publica los archivos anuales por país, no por estado. Se baja el de `FIRMS_COUNTRY` y, al
guardarlo, se recortan los focos al recuadro `REGION_BBOX`: así el de Estados Unidos (~50 MB por
año en VIIRS) queda en unos pocos MB de California. Los archivos van a `ml/data/raw/<carpeta>/`
como `<carpeta>_<año>_<región>.csv`, con las mismas columnas que publica FIRMS.

El año en curso todavía no tiene archivo anual: llega por la API de área (`current_year`), que
necesita `FIRMS_MAP_KEY`. Hasta donde FIRMS ya publicó el dato definitivo se baja ese (SP); de ahí a
hoy, el provisional (NRT), que el pipeline marca como `partial`.
"""

from __future__ import annotations

import csv
import io
import os
import shutil
from datetime import date, timedelta
from pathlib import Path

import requests

from kindra.config import FIRMS_COUNTRY, INTERIM, NRT_FOLDER, RAW, REGION_BBOX, REGION_NAME

BASE = "https://firms.modaps.eosdis.nasa.gov"
TIMEOUT_S = 180  # segundos por pedido; un CSV anual de VIIRS de Estados Unidos pesa ~50 MB

# Carpeta de FIRMS por sensor y primer año con datos: MODIS Terra desde 2000, VIIRS S-NPP desde
# 2012 y NOAA-20 desde 2018 (los años que voló junto a Aqua sirven para su factor propio).
ARCHIVE_FIRST_YEAR = {"modis": 2000, "viirs-snpp": 2012, "viirs-jpss1": 2018}
# Último año con archivo anual. El 2026 respondía 404 al 2026-11-14: llega por la API de área.
ARCHIVE_LAST_YEAR = 2025

# Fuente definitiva (SP) y provisional (NRT) de la API de área, por carpeta de `RAW`. VIIRS
# NOAA-21 no se baja: el método no lo usa.
AREA_SOURCES = {
    "modis": ("MODIS_SP", "MODIS_NRT"),
    "viirs-snpp": ("VIIRS_SNPP_SP", "VIIRS_SNPP_NRT"),
    "viirs-jpss1": ("VIIRS_NOAA20_SP", "VIIRS_NOAA20_NRT"),
}
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


def current_year(today: date | None = None) -> list[str]:
    """Baja el año en curso (el que todavía no tiene archivo anual) por la API de área.

    Pregunta a FIRMS hasta qué día publicó cada fuente (`availability`) y, por cada sensor:

    - **SP (definitivo)** desde el 1 de enero hasta su último día publicado, a `raw/<carpeta>/`.
      Un tramo ya bajado no se vuelve a pedir, salvo el último si FIRMS lo alargó.
    - **NRT (provisional)** desde el día siguiente hasta hoy, a `raw/nrt/`. Se reemplaza entero en
      cada corrida: así no queda un día repetido cuando FIRMS pasa ese día de NRT a SP.

    La API ya filtra por `REGION_BBOX`, así que no hace falta recortar.

    Args:
        today: Último día a bajar. Por defecto, hoy.

    Returns:
        Los tramos que no se pudieron bajar, con el motivo. Lista vacía si se bajó todo.

    Raises:
        RuntimeError: Si falta `FIRMS_MAP_KEY` en el entorno o en `ml/.env`.
        requests.RequestException: Si FIRMS no responde la consulta de fechas disponibles.
    """
    key = os.environ.get("FIRMS_MAP_KEY")
    if not key:
        raise RuntimeError("Falta FIRMS_MAP_KEY en ml/.env: sin ella no se puede bajar el año en curso")
    last_day = today or date.today()
    first_day = date(ARCHIVE_LAST_YEAR + 1, 1, 1)
    available = availability(key)
    nothing = (last_day + timedelta(days=1), last_day)  # rango vacío si FIRMS no lista la fuente

    failures = []
    for folder, (sp_source, nrt_source) in AREA_SOURCES.items():
        sp_last = min(available.get(sp_source, nothing)[1], last_day)
        failures += download_final(key, sp_source, first_day, sp_last, RAW / folder)
        nrt_first, nrt_last = available.get(nrt_source, nothing)
        nrt_first = max(nrt_first, sp_last + timedelta(days=1), first_day)
        failures += replace_provisional(key, nrt_source, nrt_first, min(nrt_last, last_day))
    return failures


def availability(key: str) -> dict[str, tuple[date, date]]:
    """Primer y último día publicados por fuente, según `/api/data_availability` de FIRMS."""
    response = requests.get(f"{BASE}/api/data_availability/csv/{key}/all", timeout=TIMEOUT_S)
    response.raise_for_status()
    rows = csv.DictReader(io.StringIO(response.text))
    return {row["data_id"]: (date.fromisoformat(row["min_date"]), date.fromisoformat(row["max_date"])) for row in rows}


def download_final(key: str, source: str, first: date, last: date, folder: Path) -> list[str]:
    """Baja los tramos SP de `first` a `last` que faltan en `folder`.

    El archivo lleva el primer día y el largo del tramo (`MODIS_SP_2026-07-30_2d.csv`). Si el
    último tramo creció porque FIRMS publicó más días, se borra el corto: si quedaran los dos, la
    limpieza leería esos días dos veces.
    """
    failures = []
    for start, length in forward_chunks(first, last):
        target = folder / f"{source}_{start.isoformat()}_{length}d.csv"
        if target.exists():
            continue
        try:
            save_csv(area_url(key, source, start, length), target)
        except (requests.RequestException, FirmsDownloadError) as error:
            failures.append(f"{target.name}: {error}")
            continue
        for shorter in folder.glob(f"{source}_{start.isoformat()}_*d.csv"):
            if shorter != target:
                shorter.unlink()
    return failures


def replace_provisional(key: str, source: str, first: date, last: date) -> list[str]:
    """Baja el NRT de `first` a `last` en una carpeta aparte y, si llegó entero, reemplaza el anterior.

    Si un tramo falla, el NRT anterior queda como estaba: mejor los datos de ayer que un hueco.
    """
    nrt = RAW / NRT_FOLDER
    staging = INTERIM / f"bajando-{source}"  # fuera de raw/: la limpieza lee todo raw/ y no debe ver tramos a medias
    shutil.rmtree(staging, ignore_errors=True)
    failures = []
    for start, length in forward_chunks(first, last):
        try:
            save_csv(area_url(key, source, start, length), staging / f"{source}_{start.isoformat()}_{length}d.csv")
        except (requests.RequestException, FirmsDownloadError) as error:
            failures.append(f"{source} {start.isoformat()}: {error}")
    if failures:
        shutil.rmtree(staging, ignore_errors=True)
        return failures

    nrt.mkdir(parents=True, exist_ok=True)
    for old in nrt.glob(f"{source}_*.csv"):
        old.unlink()
    if staging.exists():
        for new in staging.iterdir():
            new.replace(nrt / new.name)
        staging.rmdir()
    return []


def area_url(key: str, source: str, start: date, length: int) -> str:
    """Pedido a la API de área: `length` días desde `start`, dentro de `REGION_BBOX`."""
    area = ",".join(str(v) for v in REGION_BBOX)
    return f"{BASE}/api/area/csv/{key}/{source}/{area}/{length}/{start.isoformat()}"


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


def forward_chunks(first: date, last: date) -> list[tuple[date, int]]:
    """Parte `first`..`last` en tramos `(primer día, largo)` de hasta 5 días, contando desde `first`.

    Los cortes salen siempre del mismo primer día, así los tramos ya bajados conservan su nombre
    de una corrida a la siguiente. Vacío si `last` es anterior a `first`.
    """
    chunks = []
    start = first
    while start <= last:
        length = min(MAX_DAYS_PER_REQUEST, (last - start).days + 1)
        chunks.append((start, length))
        start += timedelta(days=length)
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
