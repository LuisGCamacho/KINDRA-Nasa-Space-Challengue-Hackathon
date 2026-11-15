"""Cámaras públicas: la lista de `web/data/cameras.json` y la descarga de sus imágenes.

Solo se usan cámaras que su dueño publica para uso abierto (Caltrans en la demo) y el video de la
demo. Las imágenes no se guardan más tiempo del que hace falta para analizarlas.
"""

from __future__ import annotations

import cv2
import numpy as np
import requests

from kindra.live_paths import CAMERAS_JSON, read_json

TIMEOUT_S = 20
USER_AGENT = "KINDRA (NASA Space Apps 2026)"
MAX_IMAGE_BYTES = 10_000_000  # 10 MB: una foto de cámara pesa KB; más que esto no es una foto
CALTRANS_PREVIOUS = 12  # Caltrans guarda las 12 imágenes anteriores de cada cámara


def load_cameras() -> list[dict]:
    """Todas las cámaras de `cameras.json`; lista vacía si todavía no se importaron."""
    return read_json(CAMERAS_JSON, [])


def get_camera(camera_id: str) -> dict:
    """Una cámara por id.

    Raises:
        KeyError: Si el id no está en `cameras.json`.
    """
    for camera in load_cameras():
        if camera["id"] == camera_id:
            return camera
    raise KeyError(f"No existe la cámara {camera_id} en {CAMERAS_JSON.name}")


def fetch_frame(camera: dict) -> np.ndarray:
    """Baja la última imagen de una cámara, en BGR (el formato de OpenCV)."""
    return fetch_image(camera["imageUrl"], camera["id"])


def fetch_recent_frames(camera: dict, count: int = 4) -> list[np.ndarray]:
    """Últimas `count` imágenes de la cámara, de la más vieja a la actual.

    Sirve para ver si el humo sigue varias imágenes seguidas (`track.py`) sin esperar a que la
    cámara publique otras. Solo Caltrans guarda las anteriores; las demás devuelven solo la actual.
    Una imagen anterior que falla se salta: la actual sí tiene que llegar.

    Args:
        camera: Cámara del contrato `Camera`.
        count: Imágenes en total, contando la actual (1 a 13 en Caltrans).
    """
    older = []
    for url in reversed(previous_image_urls(camera, count - 1)):
        try:
            older.append(fetch_image(url, camera["id"]))
        except (requests.RequestException, ValueError):
            continue
    return [*older, fetch_frame(camera)]


def previous_image_urls(camera: dict, count: int) -> list[str]:
    """URLs de las imágenes anteriores de Caltrans, de la más reciente a la más vieja.

    Caltrans las publica junto a la actual: `.../image/{cámara}/previous/{cámara}-{n}.jpg`, con
    `n` de 1 (la anterior) a 12.
    """
    if camera["provider"] != "caltrans" or count < 1:
        return []
    folder, _ = camera["imageUrl"].rsplit("/", 1)
    slug = folder.rsplit("/", 1)[-1]
    return [f"{folder}/previous/{slug}-{n}.jpg" for n in range(1, min(count, CALTRANS_PREVIOUS) + 1)]


def fetch_image(url: str, camera_id: str) -> np.ndarray:
    """Baja una imagen y la decodifica en BGR.

    Raises:
        requests.HTTPError: Si la cámara responde con error.
        ValueError: Si lo que llegó no es una imagen o pesa demasiado.
    """
    response = requests.get(url, timeout=TIMEOUT_S, headers={"User-Agent": USER_AGENT})
    response.raise_for_status()
    if len(response.content) > MAX_IMAGE_BYTES:
        raise ValueError(f"La cámara {camera_id} devolvió {len(response.content)} bytes: no es una foto")
    image = cv2.imdecode(np.frombuffer(response.content, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"La cámara {camera_id} no devolvió una imagen válida")
    return image
