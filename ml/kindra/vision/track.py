"""Seguimiento: el mismo humo conserva su id de una imagen a la siguiente.

Sirve para dos cosas:

- **Video de la demo:** la app dibuja el recuadro siguiendo al humo (`web/data/live/tracks/`).
- **Cámaras de Caltrans:** sus 12 imágenes anteriores dicen si el humo sigue ahí. El humo real
  dura; un auto, un reflejo o una nube que pasa, no (`agent/rules.py` pide 3 imágenes o más).

No se usa el ByteTrack de Ultralytics del tutorial porque corre un solo modelo, y aquí son dos
(Pyronear y D-Fire). Se une cada recuadro con el de la imagen anterior que más se le superpone,
algo simple que alcanza para pocas regiones por imagen.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from pathlib import Path

import numpy as np

from kindra.contracts import FireRegion, TrackFrame
from kindra.vision.detect import FireDetector, iou

SAMPLES_PER_SECOND = 5  # cuadros del video que se analizan por segundo; la app interpola entre ellos
SAME_TRACK_IOU = 0.1  # superposición mínima para que sea el mismo humo (el humo crece y se mueve)
MAX_GAP = 2  # imágenes seguidas en que un humo puede faltar sin perder su id (el detector parpadea)


def track_video(video: Path, detector: FireDetector) -> list[TrackFrame]:
    """Analiza el video de la demo a 5 cuadros por segundo y sigue cada humo y llama.

    El video es de día por definición (`night=False`): de noche el detector no devuelve nada.

    Raises:
        ValueError: Si OpenCV no puede leer el video o sus cuadros por segundo.
    """
    detections = ((t, detector.detect(frame, night=False)) for t, frame in sample_video(video))
    return assign_tracks(detections)


def track_images(images: list[np.ndarray], detector: FireDetector, night: bool | None,
                 seconds_between: float) -> list[TrackFrame]:
    """Sigue el humo en imágenes de una cámara, de la más vieja a la actual.

    Args:
        images: Salida de `cameras.fetch_recent_frames`.
        night: Si es de noche en la cámara (`detect.is_night_at`).
        seconds_between: Segundos entre imágenes (`refreshSeconds` de la cámara).
    """
    detections = ((round(index * seconds_between, 2), detector.detect(image, night=night))
                  for index, image in enumerate(images))
    return assign_tracks(detections)


def assign_tracks(detections: Iterable[tuple[float, list[FireRegion]]]) -> list[TrackFrame]:
    """Pone el mismo `track_id` al mismo humo o llama en imágenes seguidas.

    Cada región se une con la región viva de la misma etiqueta que más se le superpone (al menos
    `SAME_TRACK_IOU`). Una región sin pareja empieza un id nuevo. Un id que falta más de
    `MAX_GAP` imágenes se da por terminado.

    Args:
        detections: `(segundo, regiones)` en orden de tiempo.
    """
    alive: dict[int, tuple[FireRegion, int]] = {}  # id -> (última región, índice de la imagen)
    next_id = 1
    frames = []
    for index, (t, regions) in enumerate(detections):
        alive = {tid: seen for tid, seen in alive.items() if index - seen[1] <= MAX_GAP + 1}
        taken: set[int] = set()
        tracked = []
        for region in sorted(regions, key=lambda r: r.confidence, reverse=True):
            match = best_match(region, alive, taken)
            if match is None:
                match, next_id = next_id, next_id + 1
            taken.add(match)
            alive[match] = (region, index)
            tracked.append(region.model_copy(update={"track_id": match}))
        frames.append(TrackFrame(t=t, regions=tracked))
    return frames


def best_match(region: FireRegion, alive: dict[int, tuple[FireRegion, int]], taken: set[int]) -> int | None:
    """Id vivo de la misma etiqueta que más se superpone con `region`, o `None` si ninguno alcanza."""
    best, best_iou = None, SAME_TRACK_IOU
    for tid, (previous, _) in alive.items():
        if tid in taken or previous.label != region.label:
            continue
        overlap = iou(region.box, previous.box)
        if overlap >= best_iou:
            best, best_iou = tid, overlap
    return best


def longest_track(frames: list[TrackFrame]) -> int:
    """Imágenes en que aparece el humo o la llama que más duró. `agent/rules.py` pide 3 o más."""
    counts: dict[int, int] = {}
    for frame in frames:
        for region in frame.regions:
            if region.track_id is not None:
                counts[region.track_id] = counts.get(region.track_id, 0) + 1
    return max(counts.values(), default=0)


def sample_video(video: Path, per_second: int = SAMPLES_PER_SECOND) -> Iterator[tuple[float, np.ndarray]]:
    """Cuadros del video a `per_second` por segundo, con su segundo. Lee de a uno: no carga todo."""
    import cv2

    capture = cv2.VideoCapture(str(video))
    fps = capture.get(cv2.CAP_PROP_FPS)
    if not capture.isOpened() or fps <= 0:
        capture.release()
        raise ValueError(f"No se pudo leer el video {video.name}")
    step = max(1, round(fps / per_second))
    index = 0
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if index % step == 0:
                yield round(index / fps, 2), frame
            index += 1
    finally:
        capture.release()
