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


def test_deteccion_debil_se_descarta_sin_llm():
    evidence = rules.Evidence(make_detection(("humo", 0.2, 0.1)), NO_FIRMS, persistent_frames=None)
    assert rules.decide_without_llm(evidence) == "descartar"


def test_humo_que_dura_pocos_cuadros_se_descarta():
    evidence = rules.Evidence(make_detection(("humo", 0.9, 0.1)), NO_FIRMS, persistent_frames=2)
    assert rules.decide_without_llm(evidence) == "descartar"


def test_deteccion_fuerte_va_al_llm():
    evidence = rules.Evidence(make_detection(("llama", 0.9, 0.1)), NO_FIRMS, persistent_frames=10)
    assert rules.decide_without_llm(evidence) is None


def test_anomalia_sola_no_se_confirma_sin_firms():
    evidence = rules.Evidence(make_detection(("anomalia", 0.6, 0.1)), NO_FIRMS, persistent_frames=None)
    assert rules.limit_decision("confirmar", evidence) == "revisar"


def test_anomalia_con_firms_se_puede_confirmar():
    evidence = rules.Evidence(make_detection(("anomalia", 0.6, 0.1)), FIRMS_NEAR, persistent_frames=None)
    assert rules.limit_decision("confirmar", evidence) == "confirmar"


def test_incendio_grande_por_area_o_por_firms():
    big = rules.Evidence(make_detection(("humo", 0.9, 0.3)), NO_FIRMS, persistent_frames=None)
    small = rules.Evidence(make_detection(("humo", 0.9, 0.1)), NO_FIRMS, persistent_frames=None)
    assert rules.is_large_fire(big)
    assert not rules.is_large_fire(small)
    assert rules.is_large_fire(rules.Evidence(small.detection, FIRMS_NEAR, None))


def test_cifras_inventadas_se_detectan():
    facts = '{"detecciones": ["humo 87 %"], "firms": {"nearestKm": 2.1}}'
    assert invented_numbers("Humo al 87 % y foco a 2,1 km", facts) == set()
    assert invented_numbers("Humo a 300 metros del pueblo", facts) == {"300"}


def test_un_grado_de_latitud_son_111_km():
    # Dos puntos en el meridiano de Redding (Shasta), separados por un grado de latitud.
    assert round(distance_m((-122.39, 40.0), (-122.39, 41.0)) / 1000) == 111
