"""Materiales que pueden arder cerca del fuego: lo que se ve en la imagen y lo que dice OSM.

- **En la imagen:** un YOLO preentrenado en COCO (`yolo11n`), pero **solo** con las clases auto,
  colectivo y camión. La clase persona (0) nunca se pide: KINDRA no detecta personas ni patentes.
- **En OpenStreetMap:** vegetación, edificios y tanques de combustible alrededor de la cámara.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from kindra import overpass
from kindra.config import MODELS
from kindra.contracts import NearbyMaterial
from kindra.geo import distance_m
from kindra.vision.detect import box_from_corners

VEHICLE_WEIGHTS = "yolo11n.pt"  # COCO; Ultralytics lo baja la primera vez (AGPL-3.0)
VEHICLE_CLASSES = [2, 5, 7]  # COCO: car, bus, truck. Nunca 0 (person)
MIN_CONFIDENCE = 0.4  # 0–1
OSM_RADIUS_M = 500  # metros alrededor de la cámara
MAX_PER_LABEL = 3  # más de tres del mismo tipo no cambian la decisión

OSM_FILTERS = {
    "vegetacion": ['["landuse"~"forest|grass|meadow"]', '["natural"~"wood|scrub|grassland"]'],
    "edificio": ['["building"]'],
    "tanque_combustible": ['["amenity"="fuel"]', '["man_made"="storage_tank"]'],
}


class VehicleDetector:
    """Autos, colectivos y camiones en la imagen. No conoce personas: esa clase no se pide."""

    def __init__(self, models_dir: Path = MODELS):
        from ultralytics import YOLO  # importa torch: solo cuando se usa

        models_dir.mkdir(parents=True, exist_ok=True)
        self.model = YOLO(str(models_dir / VEHICLE_WEIGHTS))

    def detect(self, image: np.ndarray) -> list[NearbyMaterial]:
        """Hasta tres vehículos, de mayor a menor confianza."""
        result = self.model.predict(image, classes=VEHICLE_CLASSES, conf=MIN_CONFIDENCE, verbose=False)[0]
        return [NearbyMaterial(label="auto", source="imagen", box=box_from_corners(*corners))
                for corners in result.boxes.xyxyn.tolist()[:MAX_PER_LABEL]]


def osm_materials(camera_position: tuple[float, float]) -> list[NearbyMaterial]:
    """Los materiales de OpenStreetMap más cercanos a la cámara, hasta tres por tipo.

    Es un pedido por tipo a Overpass, guardado en disco: cada cámara se consulta una sola vez.

    Args:
        camera_position: `(lon, lat)` de la cámara.
    """
    materials = []
    for label, filters in OSM_FILTERS.items():
        elements = overpass.around(camera_position, OSM_RADIUS_M, filters)
        materials += nearest(camera_position, elements, label)
    return materials


def nearest(camera_position: tuple[float, float], elements: list[dict], label: str) -> list[NearbyMaterial]:
    """Los `MAX_PER_LABEL` elementos más cercanos, con su distancia a la cámara en metros."""
    distances = sorted(distance_m(camera_position, overpass.element_position(e)) for e in elements)
    return [NearbyMaterial(label=label, source="osm", distance_m=round(d)) for d in distances[:MAX_PER_LABEL]]
