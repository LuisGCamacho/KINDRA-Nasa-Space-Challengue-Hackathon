"""Pruebas del seguimiento entre imágenes, sin modelos ni video."""

from kindra.contracts import Box, FireRegion
from kindra.vision.track import assign_tracks, longest_track


def smoke(x, label="humo", confidence=0.6):
    return FireRegion(label=label, confidence=confidence, box=Box(x=x, y=0.2, w=0.2, h=0.2))


def test_el_humo_que_se_mueve_poco_conserva_su_id():
    frames = assign_tracks([(0, [smoke(0.10)]), (1, [smoke(0.12)]), (2, [smoke(0.15)])])
    assert [f.regions[0].track_id for f in frames] == [1, 1, 1]
    assert longest_track(frames) == 3


def test_dos_humos_separados_tienen_ids_distintos():
    frames = assign_tracks([(0, [smoke(0.1), smoke(0.7)]), (1, [smoke(0.7), smoke(0.1)])])
    first = {r.box.x: r.track_id for r in frames[0].regions}
    second = {r.box.x: r.track_id for r in frames[1].regions}
    assert first == second and len(set(first.values())) == 2


def test_humo_y_llama_en_el_mismo_lugar_no_se_mezclan():
    frames = assign_tracks([(0, [smoke(0.1)]), (1, [smoke(0.1, label="llama")])])
    assert frames[0].regions[0].track_id != frames[1].regions[0].track_id


def test_un_parpadeo_corto_no_corta_el_seguimiento_pero_uno_largo_si():
    short = assign_tracks([(0, [smoke(0.1)]), (1, []), (2, [smoke(0.1)])])
    assert short[2].regions[0].track_id == 1
    long = assign_tracks([(0, [smoke(0.1)]), (1, []), (2, []), (3, []), (4, [smoke(0.1)])])
    assert long[4].regions[0].track_id == 2


def test_algo_que_pasa_una_sola_vez_dura_una_imagen():
    frames = assign_tracks([(0, [smoke(0.1)]), (1, [smoke(0.8)]), (2, [])])
    assert longest_track(frames) == 1
