"""Pruebas de las marcas sobre la imagen."""

import numpy as np
import pytest

from kindra.contracts import Box, FireRegion
from kindra.vision.annotate import NotMarkableError, annotate, annotate_camera, hex_to_bgr, pixels

SMOKE = FireRegion(label="humo", confidence=0.8, box=Box(x=0.25, y=0.25, w=0.5, h=0.5))


def test_la_original_no_se_toca_y_la_chica_se_agranda():
    image = np.zeros((260, 320, 3), np.uint8)  # tamaño de Caltrans
    marked = annotate(image, [SMOKE], [])
    assert image.sum() == 0
    assert marked.shape[1] == 640 and marked.sum() > 0


def test_alertcalifornia_no_se_marca():
    image = np.zeros((10, 10, 3), np.uint8)
    with pytest.raises(NotMarkableError):
        annotate_camera({"provider": "alertcalifornia"}, image, [SMOKE], [])
    assert annotate_camera({"provider": "caltrans"}, image, [SMOKE], []).shape[1] == 640


def test_recuadro_normalizado_a_pixeles_y_color_bgr():
    assert pixels(SMOKE.box, np.zeros((200, 400, 3))) == (100, 50, 300, 150)
    assert hex_to_bgr("#D7262B") == (0x2B, 0x26, 0xD7)
