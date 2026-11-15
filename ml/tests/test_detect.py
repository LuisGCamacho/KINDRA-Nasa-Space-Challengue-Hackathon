"""Pruebas de la conversión de salidas YOLO al contrato, sin bajar los modelos."""

import numpy as np

from kindra.contracts import Box, FireRegion
from kindra.vision.detect import FLAME, SMOKE, box_from_corners, is_infrared, is_night_at, merge_same_smoke, regions_from_boxes


def test_recuadro_pasa_a_esquina_mas_tamano_y_se_recorta():
    box = box_from_corners(0.25, 0.5, 0.75, 1.02)  # el borde inferior se sale apenas
    assert (box.x, box.y, box.w, box.h) == (0.25, 0.5, 0.5, 0.5)


def test_solo_se_usan_las_clases_elegidas():
    # Pyronear tiene una sola clase: cualquier otra que devolviera se ignora.
    regions = regions_from_boxes(
        corners=[[0.1, 0.1, 0.2, 0.2], [0.3, 0.3, 0.4, 0.4]],
        confidences=[0.9, 0.8],
        classes=[0.0, 1.0],
        labels=SMOKE.labels,
    )
    assert [(r.label, r.confidence) for r in regions] == [("humo", 0.9)]


def region(label, confidence, x):
    return FireRegion(label=label, confidence=confidence, box=Box(x=x, y=0.1, w=0.3, h=0.3))


def test_el_mismo_humo_de_dos_modelos_queda_una_vez():
    merged = merge_same_smoke([region("humo", 0.4, 0.1), region("humo", 0.7, 0.12), region("humo", 0.5, 0.6),
                               region("llama", 0.6, 0.1)])
    assert [(r.label, r.confidence) for r in merged] == [("humo", 0.7), ("llama", 0.6), ("humo", 0.5)]


def test_imagen_en_blanco_y_negro_es_infrarroja():
    gray = np.full((10, 10, 3), 90, np.uint8)
    color = gray.copy()
    color[:, :, 0] = 200  # azul de cielo
    assert is_infrared(gray)
    assert not is_infrared(color)


def test_noche_y_dia_en_redding():
    from datetime import datetime, timezone

    redding = (-122.39, 40.59)
    assert is_night_at(redding, datetime(2026, 11, 15, 6, 40, tzinfo=timezone.utc))  # 22:40 PST
    assert not is_night_at(redding, datetime(2026, 11, 15, 20, 0, tzinfo=timezone.utc))  # 12:00 PST


def test_modelos_fijados_a_una_version():
    assert SMOKE.revision == "v8.3.0" and SMOKE.imgsz == 1024
    assert len(FLAME.revision) == 40  # commit completo: rabahdev no publica etiquetas
