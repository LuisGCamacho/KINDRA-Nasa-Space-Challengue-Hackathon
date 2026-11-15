"""Ensayo de la demo: repite un incendio real con los mismos módulos que usa `watch`.

El caso es el **incendio Palisades del 7/1/2025**, visto por la cámara Green Peak de HPWREN
(Topanga, mira al sur). No hay cifras armadas a mano: el foco satelital sale del archivo FIRMS
local y el humo lo encuentra el detector en el video real.

- **Video:** FIgLib de HPWREN, 81 imágenes (una por minuto) de 40 min antes a 40 min después de
  la ignición. CC BY-NC 4.0: no se sube a Git, `ensure_video` lo baja la primera vez.
- **Satélite:** la primera pasada con un foco a menos de `firms_nrt.RADIUS_KM` de la cámara
  después de la ignición. El reloj del ensayo se pone en esa hora, como si el agente acabara de
  recibir el foco.

El video termina 40 min después de la ignición y el satélite pasó más tarde: el agente revisa
las imágenes que la cámara ya grabó, igual que `watch` baja las anteriores de Caltrans.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from kindra.agent import firms_nrt
from kindra.config import RAW
from kindra.contracts import FireRegion, FirmsMatch, TrackFrame
from kindra.geo import distance_m
from kindra.live_paths import WEB
from kindra.vision import detect, track

CAMERA_ID = "demo-video"  # entrada de web/data/cameras.json con la posición real de Green Peak
VIDEO = WEB / "public" / "demo" / "incendio-demo.mp4"
POSTER = WEB / "public" / "demo" / "incendio-demo.jpg"
VIDEO_URL = ("https://cdn.hpwren.ucsd.edu/HPWREN-FIgLib-Data/20250107_PalisadesFire_dwpgm-s-mobo-c/"
             "1736274332-PalisadesFire-dwpgm-s-mobo-c.mp4")
CREDIT = "Data courtesy of HPWREN, University of California San Diego (https://www.hpwren.ucsd.edu/)"

IGNITION = datetime.fromtimestamp(1736274332, tz=timezone.utc)  # 18:25:32 UTC, el nombre del video en FIgLib
IGNITION_FRAME = 40  # FIgLib pone la ignición en la imagen del medio: 40 antes y 40 después
FRAME_SECONDS = 60  # una imagen por minuto en la cámara (en el video van a 4 por segundo)
POSTER_WIDTH = 1536  # px; el original mide 3072 y la portada no necesita tanto

# Archivo anual de FIRMS por satélite: carpeta de RAW y nombre de la fuente para el informe.
ARCHIVES = {"viirs-jpss1": "VIIRS_NOAA20", "viirs-snpp": "VIIRS_SNPP", "modis": "MODIS"}
STATIC_TYPE = 2  # `type` de FIRMS para fuentes fijas (refinerías); no son incendios
DOWNLOAD_TIMEOUT_S = 300


class RehearsalError(RuntimeError):
    """Falta algo para el ensayo (el video, el archivo FIRMS de 2025 o un foco cerca)."""


@dataclass(frozen=True)
class SatellitePass:
    """La pasada del satélite que despierta al agente."""

    when: datetime
    #: Focos de esa pasada a menos de `RADIUS_KM` de la cámara, del más cercano al más lejano.
    hotspots: pd.DataFrame
    match: FirmsMatch


@dataclass(frozen=True)
class VideoReview:
    """Lo que vio el detector en las imágenes grabadas."""

    frames: list[TrackFrame]
    last_image: np.ndarray
    last_time: datetime
    #: Primera imagen con humo o llama, y su hora; `None` si el detector no vio nada.
    first_seen: tuple[int, datetime] | None


def ensure_video() -> Path:
    """Baja el video de HPWREN si falta y arma la portada (la imagen de la ignición).

    Se baja a un temporal y se renombra al final: un corte no deja un video a medias.

    Raises:
        RehearsalError: Si HPWREN no responde.
    """
    if not VIDEO.exists():
        VIDEO.parent.mkdir(parents=True, exist_ok=True)
        partial = VIDEO.with_suffix(".part")
        try:
            with requests.get(VIDEO_URL, stream=True, timeout=DOWNLOAD_TIMEOUT_S) as response:
                response.raise_for_status()
                with partial.open("wb") as file:
                    for chunk in response.iter_content(1 << 20):
                        file.write(chunk)
        except requests.RequestException as error:
            partial.unlink(missing_ok=True)
            raise RehearsalError(f"No se pudo bajar el video de HPWREN: {error}") from error
        partial.replace(VIDEO)
    if not POSTER.exists():
        write_poster()
    return VIDEO


def write_poster() -> None:
    """Portada del video: la imagen de la ignición, todavía sin humo a la vista."""
    import cv2

    capture = cv2.VideoCapture(str(VIDEO))
    capture.set(cv2.CAP_PROP_POS_FRAMES, IGNITION_FRAME)
    ok, image = capture.read()
    capture.release()
    if not ok:
        raise RehearsalError(f"No se pudo leer la imagen {IGNITION_FRAME} del video")
    height = round(image.shape[0] * POSTER_WIDTH / image.shape[1])
    small = cv2.resize(image, (POSTER_WIDTH, height), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(POSTER), small, [cv2.IMWRITE_JPEG_QUALITY, 82])


def archive_hotspots(day: str, raw: Path = RAW) -> pd.DataFrame:
    """Focos de un día (`YYYY-MM-DD`) en los archivos anuales de FIRMS, sin fuentes fijas.

    Raises:
        RehearsalError: Si no está ningún archivo de ese año (`python -m kindra download`).
    """
    year = day[:4]
    tables = []
    for folder, source in ARCHIVES.items():
        path = raw / folder / f"{folder}_{year}_California.csv"
        if path.exists():
            df = pd.read_csv(path)
            tables.append(df[df["acq_date"] == day].assign(source=source))
    if not tables:
        raise RehearsalError(f"Faltan los archivos FIRMS de {year} en {raw}: correr `python -m kindra download`")
    df = pd.concat(tables, ignore_index=True)
    return df[df["type"] != STATIC_TYPE] if "type" in df else df


def first_pass(hotspots_df: pd.DataFrame, position: tuple[float, float], after: datetime) -> SatellitePass | None:
    """La primera pasada después de `after` con un foco a menos de `RADIUS_KM` de `position`.

    El reloj del ensayo es la hora de esa pasada: el foco tiene "0 h" de antigüedad, como un foco
    NRT que acaba de llegar.
    """
    if hotspots_df.empty:
        return None
    df = hotspots_df.assign(
        when=firms_nrt.acquired_at(hotspots_df),
        km=[distance_m(position, (lon, lat)) / 1000
            for lon, lat in zip(hotspots_df["longitude"], hotspots_df["latitude"])],
    )
    df = df[(df["when"] > after) & (df["km"] <= firms_nrt.RADIUS_KM)]
    if df.empty:
        return None
    when = df["when"].min().to_pydatetime()
    rows = df[df["when"] == when].sort_values("km")
    return SatellitePass(when=when, hotspots=rows, match=firms_nrt.nearest_match(rows, position, when))


def frame_time(index: int) -> datetime:
    """Hora UTC de la imagen `index` del video: una por minuto alrededor de la ignición."""
    return IGNITION + timedelta(seconds=(index - IGNITION_FRAME) * FRAME_SECONDS)


def review_video(video: Path, detector: detect.FireDetector,
                 on_frame: Callable[[int, datetime, list[FireRegion]], None] | None = None) -> VideoReview:
    """Corre el detector sobre cada imagen del video y sigue el humo entre ellas.

    Se lee de a una imagen (miden 3072 × 2048: las 81 juntas no entran cómodas en memoria) y se
    guarda solo la última, que es la que se marca y va en el correo.

    Args:
        on_frame: Se llama con cada imagen analizada, para contarla en la consola.

    Raises:
        RehearsalError: Si el video no tiene imágenes.
    """
    last: dict = {}
    first_seen: list[tuple[int, datetime]] = []

    def detections() -> Iterator[tuple[float, list[FireRegion]]]:
        for index, (second, image) in enumerate(track.sample_video(video, per_second=video_fps(video))):
            regions = detector.detect(image, night=False)  # 10:25 hora local: es de día
            when = frame_time(index)
            if regions and not first_seen:
                first_seen.append((index, when))
            last.update(image=image, when=when)
            if on_frame is not None:
                on_frame(index, when, regions)
            yield second, regions

    frames = track.assign_tracks(detections())
    if not last:
        raise RehearsalError(f"El video {video.name} no tiene imágenes")
    return VideoReview(frames=frames, last_image=last["image"], last_time=last["when"],
                       first_seen=first_seen[0] if first_seen else None)


def video_fps(video: Path) -> int:
    """Cuadros por segundo del video: se analizan todos, porque cada uno es un minuto distinto."""
    import cv2

    capture = cv2.VideoCapture(str(video))
    fps = capture.get(cv2.CAP_PROP_FPS)
    capture.release()
    return max(1, round(fps))


def minutes_after_ignition(when: datetime) -> int:
    """Minutos entre la ignición y `when` (negativos antes)."""
    return round((when - IGNITION).total_seconds() / 60)
