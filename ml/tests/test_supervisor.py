"""Pruebas del supervisor con un Gemini falso: nunca se llama a la API."""

import pytest

from kindra.agent import llm_client, supervisor
from kindra.agent.rules import Evidence
from kindra.contracts import Box, Detection, FireRegion, FirmsMatch, ModelInfo

NO_FIRMS = FirmsMatch(found=False)
FIRMS_NEAR = FirmsMatch(found=True, nearest_km=2.5, hours_ago=3.0, source="VIIRS_NOAA20_NRT")


def evidence(label="humo", confidence=0.8, firms=NO_FIRMS, frames=None):
    detection = Detection(
        id="det-1", camera_id="caltrans-d2-sugarloaf", captured_at="2026-11-15T18:00:00Z",
        frame_url="/live/frames/det-1.jpg", annotated_url="/live/frames/det-1-marcada.jpg",
        regions=[FireRegion(label=label, confidence=confidence, box=Box(x=0.1, y=0.1, w=0.2, h=0.2))],
        materials=[], model=ModelInfo(name="prueba", version="0"),
    )
    return Evidence(detection=detection, firms=firms, persistent_frames=frames)


def fake_gemini(monkeypatch, **answer):
    calls = []

    def ask(system, text, output, image_jpeg=None):
        calls.append(text)
        return output(**{"decision": "confirmar", "confidence": 0.9, "reasons": ["Columna de humo gris"],
                         "headline": "Humo en Sugarloaf", "summary": "Se ve una columna de humo.", **answer})

    monkeypatch.setattr(llm_client, "ask", ask)
    return calls


def test_deteccion_debil_se_descarta_sin_preguntar(monkeypatch):
    calls = fake_gemini(monkeypatch)
    verdict = supervisor.supervise(evidence(confidence=0.2), b"jpg", "Sugarloaf")
    assert verdict.review.decision == "descartar" and verdict.draft is None and calls == []


def test_gemini_confirma_y_su_texto_pasa(monkeypatch):
    calls = fake_gemini(monkeypatch)
    verdict = supervisor.supervise(evidence(firms=FIRMS_NEAR), b"jpg", "Sugarloaf")
    assert verdict.review.decision == "confirmar" and verdict.draft.headline == "Humo en Sugarloaf"
    assert "2,5 km" in calls[0] and "hace 3 h" in calls[0]


def test_cifra_inventada_usa_la_plantilla(monkeypatch):
    fake_gemini(monkeypatch, summary="El fuego cubre 40 hectáreas.")
    verdict = supervisor.supervise(evidence(firms=FIRMS_NEAR), b"jpg", "Sugarloaf")
    assert verdict.draft.headline == "Posible incendio en Sugarloaf"


def test_anomalia_sola_sin_firms_no_se_confirma(monkeypatch):
    fake_gemini(monkeypatch)
    verdict = supervisor.supervise(evidence(label="anomalia", confidence=0.6), b"jpg", "Sugarloaf")
    assert verdict.review.decision == "revisar" and verdict.draft is None


@pytest.mark.parametrize("decision", ["descartar", "revisar"])
def test_sin_confirmar_no_hay_correo(monkeypatch, decision):
    fake_gemini(monkeypatch, decision=decision)
    assert supervisor.supervise(evidence(), b"jpg", "Sugarloaf").draft is None


def test_si_gemini_falla_queda_en_revisar(monkeypatch):
    def broken(*_args, **_kwargs):
        raise llm_client.LLMUnavailable("Connection error")

    monkeypatch.setattr(llm_client, "ask", broken)
    verdict = supervisor.supervise(evidence(), b"jpg", "Sugarloaf")
    assert verdict.review.decision == "revisar" and verdict.review.confidence == 0.8 and verdict.draft is None
