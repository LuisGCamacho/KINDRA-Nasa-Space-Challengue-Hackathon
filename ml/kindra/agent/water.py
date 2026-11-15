"""Fuentes de agua cerca del fuego, de OpenStreetMap: hidrantes, ríos, lagos y represas.

Solo se buscan cuando el incendio es grande (`rules.is_large_fire`), para no gastar pedidos a
Overpass. Se hace un solo pedido para los cuatro tipos, y la distancia se mide al punto más
cercano de cada río o lago, no a su centro: el centro de un río largo puede quedar a kilómetros.
"""

from __future__ import annotations

from math import cos, radians

from kindra import overpass
from kindra.contracts import WaterKind, WaterSource
from kindra.geo import distance_m

RADIUS_M = 3000  # metros alrededor del fuego
MAX_SOURCES = 5  # las cinco más cercanas alcanzan para el correo y el mapa

# Filtros de Overpass que traen agua de algún tipo; después `water_kind` clasifica cada elemento.
FILTERS = [
    '["emergency"="fire_hydrant"]',
    '["waterway"~"^(river|stream|canal|dam)$"]',
    '["natural"="water"]',
    '["landuse"="reservoir"]',
]


def water_sources(position: tuple[float, float]) -> list[WaterSource]:
    """Las fuentes de agua más cercanas a `(lon, lat)`, de la más cercana a la más lejana.

    Raises:
        requests.RequestException: Si ningún servidor de Overpass responde.
    """
    elements = overpass.around(position, RADIUS_M, FILTERS, geometry=True)
    return nearest_sources(position, elements)


def nearest_sources(position: tuple[float, float], elements: list[dict]) -> list[WaterSource]:
    """Clasifica los elementos de OSM y devuelve las `MAX_SOURCES` fuentes más cercanas.

    Un río con nombre aparece una sola vez aunque OSM lo tenga partido en varias vías o también
    como relación: queda su tramo más cercano.
    """
    sources = []
    for element in elements:
        kind = water_kind(element.get("tags", {}))
        if kind is None:
            continue
        nearest = nearest_point(position, overpass.element_points(element))
        sources.append(WaterSource(
            id=f"osm-{element['type']}-{element['id']}",
            kind=kind,
            name=element.get("tags", {}).get("name"),
            position=(round(nearest[0], 5), round(nearest[1], 5)),  # ~1 m
            distance_m=round(distance_m(position, nearest)),
        ))
    seen: set[tuple[str, str]] = set()
    unique = []
    for source in sorted(sources, key=lambda source: source.distance_m):
        if source.name is not None:
            if (source.kind, source.name) in seen:
                continue
            seen.add((source.kind, source.name))
        unique.append(source)
    return unique[:MAX_SOURCES]


def nearest_point(position: tuple[float, float], points: list[tuple[float, float]]) -> tuple[float, float]:
    """Punto más cercano a `position` sobre la línea que une `points` (no solo sus vértices).

    En unos pocos kilómetros la Tierra se puede tratar como plana: se proyecta cada tramo en
    metros alrededor de `position` y se busca el pie de la perpendicular.
    """
    if len(points) == 1:
        return points[0]
    lon0, lat0 = position
    scale_x = cos(radians(lat0))  # un grado de longitud se achica con la latitud

    def to_xy(point):
        return (point[0] - lon0) * scale_x, point[1] - lat0

    best, best_d2 = points[0], float("inf")
    for a, b in zip(points, points[1:]):
        (ax, ay), (bx, by) = to_xy(a), to_xy(b)
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        t = 0.0 if length2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / length2))
        px, py = ax + t * dx, ay + t * dy
        if px * px + py * py < best_d2:
            best_d2 = px * px + py * py
            best = (lon0 + px / scale_x, lat0 + py)
    return best


def water_kind(tags: dict) -> WaterKind | None:
    """Tipo del contrato según las etiquetas de OSM, o `None` si no es una fuente de agua útil."""
    if tags.get("emergency") == "fire_hydrant":
        return "hidrante"
    if tags.get("waterway") == "dam" or tags.get("water") == "reservoir" or tags.get("landuse") == "reservoir":
        return "represa"
    if tags.get("waterway") in {"river", "stream", "canal"}:
        return "rio"
    if tags.get("natural") == "water":
        return "lago"
    return None
