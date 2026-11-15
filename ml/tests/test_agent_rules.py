"""Pruebas de las reglas fijas del agente y del control de cifras inventadas."""

from kindra.agent import rules
from kindra.agent.numbers_guard import invented_numbers
from kindra.contracts import Box, Detection, FireRegion, FirmsMatch, ModelInfo
from kindra.geo import distance_m


def make_detection(*regions: tuple[str, float, float]) -> Detection:
    """Detección de prueba: cada región es (etiqueta, confianza, lado del recuadro)."""
    return Detection(
        id="det-prueba",
        camera_id="demo-video",
        captured_at="2026-11-14T18:00:00Z",
        frame_url="/live/frames/det-prueba.jpg",
        annotated_url="/live/frames/det-prueba-marcada.jpg",
        regions=[FireRegion(label=l, confidence=c, box=Box(x=0, y=0, w=s, h=s)) for l, c, s in regions],
        materials=[],
        model=ModelInfo(name="prueba", version="0"),
    )


NO_FIRMS = FirmsMatch(found=False)
FIRMS_NEAR = FirmsMatch(found=True, nearest_km=2.1, hours_ago=3, source="VIIRS_NOAA20_NRT")


def test_weak_detection_is_discarded_without_llm():
    evidence = rules.Evidence(make_detection(("humo", 0.2, 0.1)), NO_FIRMS, persistent_frames=None)
    assert rules.decide_without_llm(evidence) == "descartar"


def test_short_track_is_discarded():
    evidence = rules.Evidence(make_detection(("humo", 0.9, 0.1)), NO_FIRMS, persistent_frames=2)
    assert rules.decide_without_llm(evidence) == "descartar"


def test_strong_detection_goes_to_llm():
    evidence = rules.Evidence(make_detection(("llama", 0.9, 0.1)), NO_FIRMS, persistent_frames=10)
    assert rules.decide_without_llm(evidence) is None


def test_anomaly_alone_cannot_be_confirmed_without_firms():
    evidence = rules.Evidence(make_detection(("anomalia", 0.6, 0.1)), NO_FIRMS, persistent_frames=None)
    assert rules.limit_decision("confirmar", evidence) == "revisar"


def test_anomaly_with_firms_can_be_confirmed():
    evidence = rules.Evidence(make_detection(("anomalia", 0.6, 0.1)), FIRMS_NEAR, persistent_frames=None)
    assert rules.limit_decision("confirmar", evidence) == "confirmar"


def test_large_fire_by_area_or_firms():
    big = rules.Evidence(make_detection(("humo", 0.9, 0.3)), NO_FIRMS, persistent_frames=None)
    small = rules.Evidence(make_detection(("humo", 0.9, 0.1)), NO_FIRMS, persistent_frames=None)
    assert rules.is_large_fire(big)
    assert not rules.is_large_fire(small)
    assert rules.is_large_fire(rules.Evidence(small.detection, FIRMS_NEAR, None))


def test_invented_numbers_are_caught():
    facts = '{"detecciones": ["humo 87 %"], "firms": {"nearestKm": 2.1}}'
    assert invented_numbers("Humo al 87 % y foco a 2,1 km", facts) == set()
    assert invented_numbers("Humo a 300 metros del pueblo", facts) == {"300"}


def test_distance_one_degree_of_latitude():
    assert round(distance_m((-67.5, -29.0), (-67.5, -30.0)) / 1000) == 111
