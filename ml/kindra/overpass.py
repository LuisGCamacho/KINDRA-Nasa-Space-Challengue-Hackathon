"""Cliente mínimo de Overpass (OpenStreetMap), compartido por materiales y agua.

Reglas de uso de la instancia pública: un pedido por vez, con User-Agent, y pocos pedidos por
día. Por eso cada respuesta se guarda en disco y se reutiliza: las cámaras no se mueven, así que
lo que hay alrededor de cada una se pide una sola vez.
"""

from __future__ import annotations

import hashlib
import json
import time

import requests

from kindra.config import INTERIM

# Instancia principal y espejos públicos: la principal responde 502/504 cuando está saturada.
URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
RETRY_WAIT_S = 5  # segundos de espera antes de pasar al siguiente servidor
USER_AGENT = "KINDRA (NASA Space Apps 2026)"
TIMEOUT_S = 60  # segundos que Overpass tiene para responder la consulta
CACHE = INTERIM / "overpass"  # no se sube a Git


def around(position: tuple[float, float], radius_m: int, filters: list[str],
           geometry: bool = False) -> list[dict]:
    """Elementos de OSM a menos de `radius_m` metros de `(lon, lat)` que cumplen algún filtro.

    Args:
        position: `(lon, lat)` en grados.
        radius_m: Radio en metros.
        filters: Parte entre corchetes de Overpass QL, por ejemplo `'["emergency"="fire_hydrant"]'`.
        geometry: Si es `True`, las vías traen todos sus puntos en `geometry` (para medir la
            distancia al punto más cercano de un río, no a su centro).

    Returns:
        Elementos con `lat`/`lon` (nodos) o `center` (vías y relaciones), y sus `tags`.

    Raises:
        requests.RequestException: Si ningún servidor de Overpass responde.
    """
    lon, lat = position
    parts = "".join(f"nwr{f}(around:{radius_m},{lat},{lon});" for f in filters)
    output = "out tags geom;" if geometry else "out center tags;"
    query = f"[out:json][timeout:{TIMEOUT_S}];({parts});{output}"
    return cached(query)["elements"]


def element_position(element: dict) -> tuple[float, float]:
    """`(lon, lat)` de un elemento: el punto de un nodo o el centro de una vía o relación."""
    if "geometry" in element and "center" not in element and "lat" not in element:
        return element_points(element)[len(element["geometry"]) // 2]
    if "bounds" in element and "center" not in element and "lat" not in element:
        b = element["bounds"]  # relaciones con `out geom`: el centro de su recuadro
        return (b["minlon"] + b["maxlon"]) / 2, (b["minlat"] + b["maxlat"]) / 2
    center = element.get("center", element)
    return center["lon"], center["lat"]


def element_points(element: dict) -> list[tuple[float, float]]:
    """Todos los `(lon, lat)` de un elemento: el nodo, los puntos de una vía o los de sus miembros."""
    if "lat" in element:
        return [(element["lon"], element["lat"])]
    points = [(p["lon"], p["lat"]) for p in element.get("geometry", []) if p]
    for member in element.get("members", []):
        points += [(p["lon"], p["lat"]) for p in member.get("geometry", []) if p]
    return points or [element_position(element)]


def cached(query: str) -> dict:
    """Respuesta de Overpass para `query`, leída del disco si ya se pidió antes."""
    path = CACHE / f"{hashlib.sha1(query.encode()).hexdigest()}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))

    payload = fetch(query)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")
    return payload


def fetch(query: str) -> dict:
    """Pide la consulta a cada servidor por turno hasta que uno responda.

    Un servidor saturado (429 o 5xx), caído o que devuelve HTML en vez de JSON se salta.
    """
    last_error: Exception | None = None
    for attempt, url in enumerate(URLS):
        if attempt > 0:
            time.sleep(RETRY_WAIT_S)  # un pedido por vez: no se insiste enseguida
        try:
            response = requests.post(url, data={"data": query}, timeout=TIMEOUT_S + 10,
                                     headers={"User-Agent": USER_AGENT})
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as error:  # ValueError: no era JSON
            last_error = error
    raise requests.RequestException(f"Ningún servidor de Overpass respondió: {last_error}")
