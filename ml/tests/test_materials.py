"""Pruebas de materiales cercanos, sin internet ni modelos."""

from kindra.vision.materials import MAX_PER_LABEL, VEHICLE_CLASSES, nearest

CAMERA = (-122.39, 40.59)  # Redding


def node(lon, lat):
    return {"type": "node", "lon": lon, "lat": lat}


def test_nunca_se_pide_la_clase_persona():
    assert 0 not in VEHICLE_CLASSES


def test_se_quedan_los_mas_cercanos_con_su_distancia():
    elements = [node(-122.39, 40.59 + k * 0.001) for k in (4, 1, 3, 2)]  # 0,001° de latitud ≈ 111 m
    materials = nearest(CAMERA, elements, "edificio")
    assert len(materials) == MAX_PER_LABEL
    assert [m.distance_m for m in materials] == [111, 222, 334]
    assert all(m.source == "osm" and m.box is None for m in materials)


def test_vias_usan_su_centro():
    way = {"type": "way", "center": {"lon": -122.39, "lat": 40.591}}
    assert nearest(CAMERA, [way], "vegetacion")[0].distance_m == 111
