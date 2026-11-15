"""Pruebas de las fuentes de agua, con elementos de OSM armados a mano."""

from kindra.agent.water import MAX_SOURCES, nearest_sources, water_kind

FIRE = (-122.39, 40.59)  # Redding


def test_tipos_de_agua_segun_las_etiquetas():
    assert water_kind({"emergency": "fire_hydrant"}) == "hidrante"
    assert water_kind({"waterway": "river"}) == "rio"
    assert water_kind({"natural": "water", "water": "reservoir"}) == "represa"
    assert water_kind({"natural": "water", "water": "lake"}) == "lago"
    assert water_kind({"waterway": "ditch"}) is None


def test_el_rio_se_mide_a_su_punto_mas_cercano():
    # Río recto que pasa a 0,001° (~111 m) al norte del fuego; sus vértices quedan a más de 800 m.
    river = {"type": "way", "id": 7, "tags": {"waterway": "river", "name": "Sacramento River"},
             "geometry": [{"lon": -122.40, "lat": 40.591}, {"lon": -122.38, "lat": 40.591}]}
    copy = {"type": "relation", "id": 8, "tags": {"waterway": "river", "name": "Sacramento River"},
            "members": [{"geometry": [{"lon": -122.39, "lat": 40.60}]}]}  # el mismo río, más lejos
    [source] = nearest_sources(FIRE, [river, copy])
    assert (source.kind, source.name, source.distance_m) == ("rio", "Sacramento River", 111)
    assert source.id == "osm-way-7"


def test_se_quedan_las_mas_cercanas_y_se_ignora_lo_que_no_es_agua():
    hydrants = [{"type": "node", "id": k, "lon": -122.39, "lat": 40.59 + k * 0.001,
                 "tags": {"emergency": "fire_hydrant"}} for k in range(1, 8)]
    ditch = {"type": "node", "id": 99, "lon": -122.39, "lat": 40.5901, "tags": {"waterway": "ditch"}}
    sources = nearest_sources(FIRE, hydrants + [ditch])
    assert len(sources) == MAX_SOURCES
    assert [s.distance_m for s in sources] == sorted(s.distance_m for s in sources)
    assert all(s.kind == "hidrante" for s in sources)
