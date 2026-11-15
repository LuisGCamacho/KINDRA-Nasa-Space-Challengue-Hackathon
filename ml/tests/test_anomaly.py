"""Pruebas de las anomalías de color, con imágenes armadas a mano."""

import numpy as np

from kindra.vision.anomaly import MAX_CONFIDENCE, find_anomalies

GRASS = (40, 90, 50)  # BGR verde oscuro
ORANGE = (0, 120, 255)  # BGR naranja brillante


def scene():
    return np.full((260, 320, 3), GRASS, np.uint8)


def test_mancha_naranja_nueva_es_anomalia():
    before, after = scene(), scene()
    after[120:150, 100:140] = ORANGE  # 1,4 % de la imagen
    regions = find_anomalies(before, after)
    assert len(regions) == 1 and regions[0].label == "anomalia"
    assert 0 < regions[0].confidence <= MAX_CONFIDENCE
    assert round(regions[0].box.x, 3) == round(100 / 320, 3)


def test_lo_que_ya_estaba_no_es_anomalia():
    before, after = scene(), scene()
    before[120:150, 100:140] = ORANGE
    after[120:150, 100:140] = ORANGE
    assert find_anomalies(before, after) == []


def test_mancha_chica_o_en_el_texto_de_caltrans_se_ignora():
    before, after = scene(), scene()
    after[120:123, 100:103] = ORANGE  # 9 píxeles
    after[0:30, 0:200] = ORANGE  # franja del nombre de la cámara
    assert find_anomalies(before, after) == []


def test_si_la_camara_se_movio_no_se_compara():
    before, after = scene(), np.full((260, 320, 3), (200, 200, 200), np.uint8)
    after[120:150, 100:140] = ORANGE
    assert find_anomalies(before, after) == []
