"""Dibuja las marcas sobre la imagen: recuadro, etiqueta y confianza.

La imagen marcada es la que muestra la app y la que va en el correo de alerta.

**Solo se marcan cámaras que lo permiten.** Caltrans es de dominio público y el video de la demo
es de HPWREN, CC BY-NC 4.0, que permite adaptarlo sin fines comerciales y con su crédito. ALERTCalifornia (CC BY-NC-ND 4.0) prohíbe obras derivadas: se muestra tal cual, sin
recuadros, y por eso `annotate_camera` se niega a marcar cualquier proveedor que no esté en
`MARKABLE_PROVIDERS`.

Colores de las fases del fuego del Manual de interfaz KINDRA 4 (capítulo 15); los materiales van
punteados en verde azulado. Hoy `web/src/lib/colors.ts` todavía no tiene estos colores.
"""

from __future__ import annotations

import cv2
import numpy as np

from kindra.contracts import Box, FireRegion, NearbyMaterial

MARKABLE_PROVIDERS = frozenset({"caltrans", "demo"})  # dominio público o propio; ver AGENTS.md

FIRE_COLOR = {"humo": "#D9DCE3", "llama": "#D7262B", "anomalia": "#EE6A24"}
# Sin tildes: la fuente de OpenCV (Hershey) no las tiene.
FIRE_NAME = {"humo": "Humo", "llama": "Llama", "anomalia": "Anomalia"}
MATERIAL_COLOR = "#34C3B4"
MATERIAL_NAME = {"vegetacion": "Vegetacion", "auto": "Auto", "edificio": "Edificio", "tanque_combustible": "Tanque"}

MIN_WIDTH = 640  # px; las fotos de Caltrans miden 320 de ancho y la etiqueta no se leería
FONT = cv2.FONT_HERSHEY_SIMPLEX


class NotMarkableError(ValueError):
    """El dueño de la cámara no permite dibujar sobre sus imágenes."""


def annotate_camera(camera: dict, image: np.ndarray, regions: list[FireRegion],
                    materials: list[NearbyMaterial]) -> np.ndarray:
    """Marca una imagen solo si la licencia de la cámara lo permite.

    Raises:
        NotMarkableError: Si el proveedor no está en `MARKABLE_PROVIDERS`.
    """
    if camera["provider"] not in MARKABLE_PROVIDERS:
        raise NotMarkableError(f"{camera['provider']} no permite marcar sus imágenes: se muestra sin recuadros")
    return annotate(image, regions, materials)


def annotate(image: np.ndarray, regions: list[FireRegion], materials: list[NearbyMaterial]) -> np.ndarray:
    """Copia de la imagen con las marcas; la original no se toca.

    Las imágenes angostas se agrandan a `MIN_WIDTH` antes de dibujar, para que la etiqueta se lea
    en el correo. Los recuadros están normalizados (0–1), así que sirven a cualquier tamaño.
    """
    marked = enlarge(image)
    scale = marked.shape[1] / MIN_WIDTH  # grosor y letra proporcionales al ancho
    thickness = max(2, round(2 * scale))
    for material in materials:
        if material.box is not None:
            draw_box(marked, material.box, MATERIAL_NAME[material.label], hex_to_bgr(MATERIAL_COLOR),
                     thickness, scale, dashed=True)
    for region in sorted(regions, key=lambda r: r.confidence):  # la más segura queda encima
        text = f"{FIRE_NAME[region.label]} {round(region.confidence * 100)} %"
        draw_box(marked, region.box, text, hex_to_bgr(FIRE_COLOR[region.label]), thickness, scale)
    return marked


def encode_jpeg(image: np.ndarray, quality: int = 85) -> bytes:
    """JPEG para guardar en `web/public/live/frames/` o adjuntar al correo (calidad 0–100)."""
    ok, jpeg = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("OpenCV no pudo codificar la imagen en JPEG")
    return jpeg.tobytes()


def enlarge(image: np.ndarray) -> np.ndarray:
    """Copia agrandada hasta `MIN_WIDTH` de ancho, sin deformar; las anchas se copian igual."""
    width = image.shape[1]
    if width >= MIN_WIDTH:
        return image.copy()
    factor = MIN_WIDTH / width
    return cv2.resize(image, None, fx=factor, fy=factor, interpolation=cv2.INTER_CUBIC)


def draw_box(image: np.ndarray, box: Box, text: str, color: tuple[int, int, int], thickness: int,
             scale: float, dashed: bool = False) -> None:
    """Dibuja un recuadro con su etiqueta arriba, sobre la imagen que recibe."""
    x1, y1, x2, y2 = pixels(box, image)
    if dashed:
        dashed_rectangle(image, (x1, y1), (x2, y2), color, thickness, dash=round(12 * scale))
    else:
        cv2.rectangle(image, (x1, y1), (x2, y2), color, thickness)
    label(image, text, x1, y1, color, 0.55 * scale)


def label(image: np.ndarray, text: str, x: int, y: int, color: tuple[int, int, int], font_scale: float) -> None:
    """Etiqueta con fondo del color de la marca y texto negro; baja dentro de la imagen si no entra arriba."""
    (w, h), _ = cv2.getTextSize(text, FONT, font_scale, 1)
    pad = max(4, round(h * 0.4))
    top = max(0, y - h - 2 * pad)
    x = min(x, max(0, image.shape[1] - w - 2 * pad))  # que no se corte a la derecha
    cv2.rectangle(image, (x, top), (x + w + 2 * pad, top + h + 2 * pad), color, -1)
    cv2.putText(image, text, (x + pad, top + h + pad), FONT, font_scale, (0, 0, 0), 1, cv2.LINE_AA)


def dashed_rectangle(image, top_left, bottom_right, color, thickness: int, dash: int) -> None:
    """Rectángulo punteado: OpenCV no trae uno."""
    (x1, y1), (x2, y2) = top_left, bottom_right
    for x in range(x1, x2, dash * 2):
        cv2.line(image, (x, y1), (min(x + dash, x2), y1), color, thickness)
        cv2.line(image, (x, y2), (min(x + dash, x2), y2), color, thickness)
    for y in range(y1, y2, dash * 2):
        cv2.line(image, (x1, y), (x1, min(y + dash, y2)), color, thickness)
        cv2.line(image, (x2, y), (x2, min(y + dash, y2)), color, thickness)


def pixels(box: Box, image: np.ndarray) -> tuple[int, int, int, int]:
    """Recuadro normalizado → esquinas en píxeles de esta imagen."""
    height, width = image.shape[:2]
    return (round(box.x * width), round(box.y * height),
            round((box.x + box.w) * width), round((box.y + box.h) * height))


def hex_to_bgr(color: str) -> tuple[int, int, int]:
    """`#RRGGBB` → `(B, G, R)`, el orden de OpenCV."""
    r, g, b = (int(color[i:i + 2], 16) for i in (1, 3, 5))
    return b, g, r
