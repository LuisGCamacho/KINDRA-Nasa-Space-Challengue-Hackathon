"""Anomalías: manchas de color fuego que aparecen de golpe entre dos imágenes.

Es una regla simple de OpenCV, no un modelo. Sirve para avisar de algo raro que los detectores
no reconocen, por ejemplo un resplandor de noche, cuando Pyronear y D-Fire no se usan. El agente
la trata como evidencia débil: una anomalía sola nunca confirma un incendio sin FIRMS
(`agent/rules.py`).

Probado con las 64 cámaras de Caltrans de noche: 1 anomalía falsa, las luces traseras de un auto
en Dunsmuir. Una sola imagen no alcanza para descartarla; lo hacen `track.py` (tiene que durar 3
imágenes) y `rules.py` (sin FIRMS no se confirma). Si cambia toda la escena (la cámara giró), no
se compara.
"""

from __future__ import annotations

import cv2
import numpy as np

from kindra.contracts import Box, FireRegion

# Rango HSV de rojos y naranjas brillantes (OpenCV usa matiz de 0 a 179).
FIRE_HUE_MAX = 25
MIN_SATURATION, MIN_VALUE = 120, 180  # 0–255
MIN_AREA_SHARE = 0.002  # manchas menores al 0,2 % de la imagen se ignoran
MAX_CONFIDENCE = 0.6  # una anomalía nunca llega a la confianza de un detector
MERGE_PX = 5  # px; junta manchitas vecinas: en una foto de 320 px la llama sale fragmentada
SCENE_CHANGE = 40  # diferencia media por píxel (0–255): más que esto, la cámara se movió o cambió la luz
OVERLAY_TOP, OVERLAY_BOTTOM = 0.2, 0.9  # Caltrans escribe el nombre arriba y la fecha abajo


def find_anomalies(previous: np.ndarray, current: np.ndarray) -> list[FireRegion]:
    """Zonas con color fuego en `current` que no estaban en `previous`.

    Args:
        previous: Imagen anterior de la misma cámara, en BGR.
        current: Imagen actual, en BGR.

    Returns:
        Regiones `anomalia`, de mayor a menor. Vacía si las imágenes no son comparables (otro
        tamaño o la escena entera cambió).
    """
    if previous.shape != current.shape or scene_changed(previous, current):
        return []
    new_fire = cv2.bitwise_and(fire_colored_mask(current), cv2.bitwise_not(fire_colored_mask(previous)))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (MERGE_PX, MERGE_PX))
    new_fire = cv2.morphologyEx(new_fire, cv2.MORPH_CLOSE, kernel)  # cierra huecos entre manchitas
    contours, _ = cv2.findContours(new_fire, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    height, width = current.shape[:2]
    regions = []
    for contour in contours:
        share = cv2.contourArea(contour) / (width * height)
        if share < MIN_AREA_SHARE:
            continue
        x, y, w, h = cv2.boundingRect(contour)
        regions.append(FireRegion(
            label="anomalia",
            # No es una probabilidad: crece con el tamaño de la mancha (2 % de la imagen ≈ 0,6).
            confidence=round(min(MAX_CONFIDENCE, share * 30), 3),
            box=Box(x=x / width, y=y / height, w=w / width, h=h / height),
        ))
    return sorted(regions, key=lambda region: region.confidence, reverse=True)


def fire_colored_mask(image: np.ndarray) -> np.ndarray:
    """Píxeles rojos o naranjas brillantes (255) y el resto (0), sin el texto de Caltrans."""
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, (0, MIN_SATURATION, MIN_VALUE), (FIRE_HUE_MAX, 255, 255))
    height = image.shape[0]
    mask[:int(height * OVERLAY_TOP)] = 0
    mask[int(height * OVERLAY_BOTTOM):] = 0
    return mask


def scene_changed(previous: np.ndarray, current: np.ndarray) -> bool:
    """La escena entera cambió: la cámara giró a otra posición o se ajustó la exposición."""
    difference = cv2.absdiff(previous, current)
    return float(difference.mean()) > SCENE_CHANGE
