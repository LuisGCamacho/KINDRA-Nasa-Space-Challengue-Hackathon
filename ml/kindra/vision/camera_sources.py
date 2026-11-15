"""Importa cámaras públicas a `web/data/cameras.json`, con la forma del contrato `Camera`.

Cámaras de la demo: **Caltrans CCTV, Distrito 2** (condados de Shasta, Trinity y Siskiyou), que
solo publican fotos, y las del **Distrito 7** (condado de Los Ángeles) que tienen video en vivo.
Caltrans publica la lista de cada distrito en un JSON abierto, y sus condiciones de uso dicen que
lo publicado en su sitio es de dominio público salvo que se indique otra cosa: se pueden analizar
y marcar.

ALERTCalifornia (CC BY-NC-ND 4.0) no se importa aquí: solo se muestra, sin recuadros, y el
contrato `CameraProvider` todavía no tiene un valor para ese proveedor (se acuerda con el equipo).
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import requests

from kindra.live_paths import CAMERAS_JSON, read_json, write_json

CALTRANS_URL = "https://cwwp2.dot.ca.gov/data/d{district}/cctv/cctvStatusD{district:02d}.json"
CALTRANS_TERMS = "https://dot.ca.gov/conditions-of-use"
CALTRANS_ATTRIBUTION = "Imagen: Caltrans (California Department of Transportation), dominio público"
DEMO_DISTRICT = 2
DEMO_COUNTIES = ("Shasta", "Trinity", "Siskiyou")
DEFAULT_REFRESH_MIN = 5  # minutos; la frecuencia más común de Caltrans, si una cámara no la trae
LIVE_DISTRICT = 7
LIVE_COUNTIES = ("Los Angeles",)
# Lo que Caltrans escribe en `streamingVideoURL` cuando la cámara no tiene video: no es una URL.
NO_VIDEO = {"", "Not Reported"}
TIMEOUT_S = 60
STREAM_TIMEOUT_S = 15
STREAM_CHECKS_AT_ONCE = 16  # pedidos simultáneos a Caltrans al revisar los videos
USER_AGENT = "KINDRA (NASA Space Apps 2026)"


def caltrans_cameras(district: int = DEMO_DISTRICT, counties: tuple[str, ...] = DEMO_COUNTIES,
                     only_video: bool = False) -> list[dict]:
    """Cámaras de Caltrans en servicio de un distrito, filtradas por condado.

    Args:
        district: Distrito de Caltrans (1 a 12).
        counties: Condados a conservar, con el nombre que usa Caltrans (`"Shasta"`).
        only_video: Si es `True`, solo las que tienen video en vivo y responde ahora. El
            15/11/2026, 234 de las 402 de Los Ángeles listaban un video que daba 404.

    Returns:
        Cámaras en la forma del contrato `Camera`, ordenadas por id.

    Raises:
        requests.HTTPError: Si Caltrans no entrega la lista.
    """
    response = requests.get(CALTRANS_URL.format(district=district), timeout=TIMEOUT_S,
                            headers={"User-Agent": USER_AGENT})
    response.raise_for_status()
    cameras = [camera_from_caltrans(item.get("cctv", {}), district) for item in response.json()["data"]]
    wanted = set(counties)
    chosen = [camera for camera, county in cameras if camera and county in wanted]
    if only_video:
        chosen = with_working_video(chosen)
    return sorted(chosen, key=lambda camera: camera["id"])


def with_working_video(cameras: list[dict]) -> list[dict]:
    """Las cámaras cuyo video en vivo responde ahora (`stream_online`)."""
    with_video = [camera for camera in cameras if camera["videoUrl"]]
    with ThreadPoolExecutor(STREAM_CHECKS_AT_ONCE) as pool:
        online = list(pool.map(lambda camera: stream_online(camera["videoUrl"]), with_video))
    return [camera for camera, ok in zip(with_video, online) if ok]


def stream_online(url: str) -> bool:
    """Indica si la lista HLS del video responde con una lista de verdad (`#EXTM3U`)."""
    try:
        response = requests.get(url, timeout=STREAM_TIMEOUT_S, headers={"User-Agent": USER_AGENT})
    except requests.RequestException:
        return False
    return response.ok and response.text.startswith("#EXTM3U")


def camera_from_caltrans(cctv: dict, district: int) -> tuple[dict | None, str | None]:
    """Convierte una cámara del JSON de Caltrans al contrato `Camera`.

    Returns:
        `(cámara, condado)`. La cámara es `None` si está fuera de servicio o le falta la imagen o
        la posición: sin eso no hay nada que analizar ni dónde ponerla en el mapa.
    """
    location = cctv.get("location", {})
    county = location.get("county")
    image = cctv.get("imageData", {})
    image_url = image.get("static", {}).get("currentImageURL")
    if cctv.get("inService") != "true" or not image_url:
        return None, county
    try:
        position = [float(location["longitude"]), float(location["latitude"])]  # [lon, lat]
    except (KeyError, TypeError, ValueError):
        return None, county

    # La carpeta de la imagen (`.../image/abramslakenb/abramslakenb.jpg`) es el id estable de
    # Caltrans; `index` cambia cuando el distrito agrega o quita cámaras.
    slug = image_url.rstrip("/").split("/")[-2]
    return {
        "id": f"caltrans-d{district}-{slug}",
        "name": camera_name(location),
        "provider": "caltrans",
        "position": position,
        "imageUrl": image_url,
        "videoUrl": video_url(image.get("streamingVideoURL")),
        "refreshSeconds": refresh_seconds(image.get("static", {}).get("currentImageUpdateFrequency")),
        "attribution": CALTRANS_ATTRIBUTION,
        "termsUrl": CALTRANS_TERMS,
    }, county


def video_url(value: str | None) -> str | None:
    """Video en vivo (HLS `.m3u8`) de la cámara, o `None` si Caltrans no publica uno."""
    value = (value or "").strip()
    return None if value in NO_VIDEO or not value.startswith("https://") else value


def camera_name(location: dict) -> str:
    """Nombre para la pantalla: lugar, ruta y condado, por ejemplo "Abrams Lake NB · I-5 · Siskiyou"."""
    parts = [location.get("locationName"), location.get("route"), location.get("county")]
    return " · ".join(part for part in parts if part)


def refresh_seconds(minutes: str | None) -> int:
    """Caltrans da la frecuencia de la imagen en minutos; el contrato la pide en segundos."""
    try:
        return max(1, int(minutes)) * 60
    except (TypeError, ValueError):
        return DEFAULT_REFRESH_MIN * 60


def add_cameras(new: list[dict]) -> int:
    """Agrega las cámaras nuevas a `cameras.json` sin duplicar ids. Devuelve cuántas agregó.

    Las que ya estaban no se tocan, así no se pisa una cámara que el equipo editó a mano.
    """
    current = read_json(CAMERAS_JSON, [])
    known = {camera["id"] for camera in current}
    fresh = [camera for camera in new if camera["id"] not in known]
    write_json(CAMERAS_JSON, current + fresh)
    return len(fresh)
