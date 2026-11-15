"""Importa cámaras públicas a `web/data/cameras.json`, con la forma del contrato `Camera`.

Cámaras de la demo: **Caltrans CCTV, Distrito 2** (condados de Shasta, Trinity y Siskiyou).
Caltrans publica la lista de cada distrito en un JSON abierto, y sus condiciones de uso dicen que
lo publicado en su sitio es de dominio público salvo que se indique otra cosa: se pueden analizar
y marcar.

ALERTCalifornia (CC BY-NC-ND 4.0) no se importa aquí: solo se muestra, sin recuadros, y el
contrato `CameraProvider` todavía no tiene un valor para ese proveedor (se acuerda con el equipo).
"""

from __future__ import annotations

import requests

from kindra.live_paths import CAMERAS_JSON, read_json, write_json

CALTRANS_URL = "https://cwwp2.dot.ca.gov/data/d{district}/cctv/cctvStatusD{district:02d}.json"
CALTRANS_TERMS = "https://dot.ca.gov/conditions-of-use"
CALTRANS_ATTRIBUTION = "Imagen: Caltrans (California Department of Transportation), dominio público"
DEMO_DISTRICT = 2
DEMO_COUNTIES = ("Shasta", "Trinity", "Siskiyou")
DEFAULT_REFRESH_MIN = 5  # minutos; la frecuencia más común de Caltrans, si una cámara no la trae
TIMEOUT_S = 60
USER_AGENT = "KINDRA (NASA Space Apps 2026)"


def caltrans_cameras(district: int = DEMO_DISTRICT, counties: tuple[str, ...] = DEMO_COUNTIES) -> list[dict]:
    """Cámaras de Caltrans en servicio de un distrito, filtradas por condado.

    Args:
        district: Distrito de Caltrans (1 a 12).
        counties: Condados a conservar, con el nombre que usa Caltrans (`"Shasta"`).

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
    return sorted((camera for camera, county in cameras if camera and county in wanted),
                  key=lambda camera: camera["id"])


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
        "videoUrl": image.get("streamingVideoURL") or None,
        "refreshSeconds": refresh_seconds(image.get("static", {}).get("currentImageUpdateFrequency")),
        "attribution": CALTRANS_ATTRIBUTION,
        "termsUrl": CALTRANS_TERMS,
    }, county


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
