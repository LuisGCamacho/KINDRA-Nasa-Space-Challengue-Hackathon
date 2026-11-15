"""Detector de humo y llama con dos modelos YOLO ya entrenados (sin entrenar uno propio).

- **Humo: Pyronear `yolov11s` v8.3.0**, entrenado con cámaras de paisaje para humo temprano de
  incendio forestal. Una sola clase.
- **Llama y humo grande: YOLOv8n de `rabahdev` ajustado con D-Fire.** Pyronear está hecho para
  humo temprano y casi no ve una columna ya desarrollada (probado con fotos reales: 0,03); D-Fire
  sí. Cuando los dos marcan el mismo humo queda un solo recuadro, el de mayor confianza.

**De noche no se detecta nada.** Probado con las 64 cámaras de Caltrans a las 22:40: los faros, el
alumbrado y el infrarrojo dieron 16 cámaras con humo o llama falsos de 0,35 o más. Ninguno de los
dos modelos se entrenó para la noche. De noche vigila FIRMS (VIIRS pasa cerca de la 1:30).

Los dos modelos solo conocen humo y llama: no pueden detectar personas ni patentes. Las
anomalías de color salen de `anomaly.py`, no de aquí. Licencias: rabahdev es AGPL-3.0 y Pyronear
publica el modelo como Apache-2.0; por la AGPL el repositorio tiene que ser público.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np

from kindra.config import MODELS
from kindra.contracts import Box, FireLabel, FireRegion, ModelInfo
from kindra.geo import sun_elevation_deg


@dataclass(frozen=True)
class ModelSpec:
    """Un modelo de Hugging Face fijado a una versión, con su forma de uso recomendada."""

    repo: str
    revision: str  # etiqueta o commit: así el modelo no cambia solo entre una corrida y otra
    labels: dict[int, FireLabel]  # clases del modelo que se usan, con su etiqueta del contrato
    imgsz: int  # px; el tamaño con que se entrenó
    conf: float  # confianza mínima (0–1) para devolver un recuadro
    iou: float  # solapamiento desde el que dos recuadros se juntan en uno
    filename: str = "best.pt"


SMOKE = ModelSpec(repo="pyronear/yolov11s", revision="v8.3.0", labels={0: "humo"},
                  imgsz=1024, conf=0.2, iou=0.01)  # valores del README de Pyronear
FLAME = ModelSpec(repo="rabahdev/fire-smoke-yolov8n", revision="13017fe8af477c25f5298d168e2dfede4b000753",
                  labels={0: "humo", 1: "llama"}, imgsz=640, conf=0.25, iou=0.45)
# Las confianzas son bajas a propósito: el detector propone y `agent/rules.py` descarta lo débil
# (menos de 0,35), así un humo tenue llega al seguimiento entre imágenes antes de descartarse.
SAME_SMOKE_IOU = 0.3  # dos recuadros de humo que se solapan más que esto son el mismo humo
NIGHT_SUN_DEG = -6.0  # sol 6° bajo el horizonte: fin del crepúsculo civil, ya no se ve el paisaje
INFRARED_MAX_CHROMA = 3.0  # diferencia media entre canales (0–255): menos que esto es blanco y negro
OVERLAY_TOP, OVERLAY_BOTTOM = 0.2, 0.9  # Caltrans escribe el nombre arriba y la fecha abajo


class FireDetector:
    """Corre los dos modelos sobre una imagen. El resto del código no depende de Ultralytics."""

    def __init__(self, smoke: ModelSpec = SMOKE, flame: ModelSpec = FLAME, models_dir: Path = MODELS):
        from ultralytics import YOLO  # importa torch: tarda, solo cuando se usa el detector

        self.specs = (smoke, flame)
        self.models = [YOLO(str(download_weights(spec, models_dir))) for spec in self.specs]
        self.info = ModelInfo(
            name="Pyronear yolov11s (humo) + YOLOv8n D-Fire de rabahdev (llama)",
            version=f"{smoke.revision}+{flame.revision[:7]}",
        )

    def detect(self, image: np.ndarray, night: bool | None = None) -> list[FireRegion]:
        """Humo y llama de una imagen BGR, de mayor a menor confianza, sin humo repetido.

        Args:
            image: Imagen en BGR.
            night: Si es de noche en la cámara (`is_night_at`). `None` cuando no se sabe la hora,
                y entonces solo se reconoce la noche si la imagen es infrarroja. El video de la
                demo pasa `False`.

        Returns:
            Lista vacía de noche: ahí los modelos confunden luces con fuego.
        """
        if night or (night is None and is_infrared(image)):
            return []
        regions = []
        for spec, model in zip(self.specs, self.models):
            result = model.predict(image, imgsz=spec.imgsz, conf=spec.conf, iou=spec.iou, verbose=False)[0]
            boxes = result.boxes
            regions += regions_from_boxes(boxes.xyxyn.tolist(), boxes.conf.tolist(), boxes.cls.tolist(), spec.labels)
        return merge_same_smoke(regions)


def download_weights(spec: ModelSpec, models_dir: Path = MODELS) -> Path:
    """Baja los pesos a `ml/models/` (no se sube a Git). Si ya están, no los vuelve a pedir."""
    from huggingface_hub import hf_hub_download

    target = models_dir / spec.repo.replace("/", "__") / spec.revision
    return Path(hf_hub_download(spec.repo, spec.filename, revision=spec.revision, local_dir=target))


def regions_from_boxes(corners: list[list[float]], confidences: list[float], classes: list[float],
                       labels: dict[int, FireLabel]) -> list[FireRegion]:
    """Convierte las salidas de YOLO en regiones del contrato, solo con las clases de `labels`.

    Args:
        corners: Esquinas normalizadas `[x1, y1, x2, y2]` de cada recuadro (`boxes.xyxyn`).
        confidences: Confianza de cada recuadro (0–1).
        classes: Clase de cada recuadro según el modelo.
        labels: Clases que se usan y su etiqueta (`{0: "humo"}`).
    """
    return [
        FireRegion(label=labels[int(cls)], confidence=round(float(conf), 3), box=box_from_corners(*xyxy))
        for xyxy, conf, cls in zip(corners, confidences, classes)
        if int(cls) in labels
    ]


def merge_same_smoke(regions: list[FireRegion]) -> list[FireRegion]:
    """Deja un solo recuadro por humo: si dos se solapan, queda el de mayor confianza.

    Returns:
        Las regiones de mayor a menor confianza.
    """
    kept: list[FireRegion] = []
    for region in sorted(regions, key=lambda r: r.confidence, reverse=True):
        repeated = region.label == "humo" and any(
            other.label == "humo" and iou(region.box, other.box) > SAME_SMOKE_IOU for other in kept)
        if not repeated:
            kept.append(region)
    return kept


def iou(a: Box, b: Box) -> float:
    """Intersección sobre unión de dos recuadros (0 = no se tocan, 1 = iguales)."""
    width = max(0.0, min(a.x + a.w, b.x + b.w) - max(a.x, b.x))
    height = max(0.0, min(a.y + a.h, b.y + b.h) - max(a.y, b.y))
    shared = width * height
    union = a.area + b.area - shared
    return shared / union if union > 0 else 0.0


def is_night_at(position: tuple[float, float], when: datetime) -> bool:
    """De noche en la cámara: el sol más de 6° bajo el horizonte."""
    return sun_elevation_deg(position, when) < NIGHT_SUN_DEG


def is_infrared(image: np.ndarray) -> bool:
    """Imagen infrarroja (blanco y negro), sin contar el texto que Caltrans pone arriba y abajo.

    Se mide la diferencia entre canales y no la saturación HSV, que en píxeles oscuros sale alta
    aunque no haya color.
    """
    height = image.shape[0]
    body = image[int(height * OVERLAY_TOP):int(height * OVERLAY_BOTTOM)].astype(np.int16)
    b, g, r = body[:, :, 0], body[:, :, 1], body[:, :, 2]
    chroma = np.maximum(np.maximum(abs(b - g), abs(g - r)), abs(b - r))
    return float(chroma.mean()) < INFRARED_MAX_CHROMA


def box_from_corners(x1: float, y1: float, x2: float, y2: float) -> Box:
    """Esquinas normalizadas de YOLO → recuadro del contrato (esquina superior izquierda + tamaño).

    Se recorta a 0–1 porque YOLO puede devolver un borde apenas fuera de la imagen.
    """
    x1, y1, x2, y2 = (min(1.0, max(0.0, value)) for value in (x1, y1, x2, y2))
    return Box(x=round(x1, 4), y=round(y1, 4), w=round(x2 - x1, 4), h=round(y2 - y1, 4))
