"""Pruebas del informe del agente, sin la app."""

from datetime import datetime, timezone

from kindra.agent import report
from kindra.agent.numbers_guard import invented_numbers
from kindra.contracts import AgentReview, Box, Detection, FireRegion, FirmsMatch, ModelInfo

DETECTION = Detection(
    id="det-prueba", camera_id="caltrans-d2-sugarloaf", captured_at="2026-11-15T18:00:00Z",
    frame_url="/live/frames/det-prueba.jpg", annotated_url="/live/frames/det-prueba-marcada.jpg",
    regions=[FireRegion(label="humo", confidence=0.87, box=Box(x=0.1, y=0.1, w=0.2, h=0.2))],
    materials=[], model=ModelInfo(name="prueba", version="0"),
)
FIRMS = FirmsMatch(found=True, nearest_km=2.1, hours_ago=3, source="VIIRS_NOAA20_NRT")
WHEN = datetime(2026, 11, 15, 18, 0, 5, tzinfo=timezone.utc)


def test_alerta_confirmada_lleva_el_texto_y_sale_pendiente():
    review = AgentReview(decision="confirmar", confidence=0.9, reasons=["Columna de humo"])
    draft = report.template_draft("Sugarloaf", DETECTION, FIRMS)
    body = report.build_report(DETECTION, review, FIRMS, [], draft, WHEN).to_json()
    assert body["alert"]["id"] == "alerta-det-prueba"
    assert body["alert"]["status"] == "pendiente" and body["alert"]["emailedAt"] is None
    assert body["alert"]["createdAt"] == "2026-11-15T18:00:05Z"
    assert body["draft"]["headline"] == "Posible incendio en Sugarloaf"


def test_alerta_descartada_no_lleva_correo():
    review = AgentReview(decision="descartar", confidence=0.8, reasons=["Nube baja"])
    body = report.build_report(DETECTION, review, FIRMS, [], report.template_draft("X", DETECTION, FIRMS), WHEN)
    assert body.alert.status == "descartada" and body.draft is None


def test_la_plantilla_no_inventa_cifras():
    draft = report.template_draft("Sugarloaf", DETECTION, FIRMS)
    facts = '{"confianza": 87, "firms": {"nearestKm": 2.1, "hoursAgo": 3, "source": "VIIRS_NOAA20_NRT"}}'
    assert invented_numbers(f"{draft.headline} {draft.summary}", facts) == set()


def test_sin_app_el_informe_queda_en_la_bandeja(tmp_path, monkeypatch):
    monkeypatch.setattr(report, "OUTBOX", tmp_path)
    monkeypatch.delenv("APP_URL", raising=False)
    review = AgentReview(decision="revisar", confidence=0.5, reasons=["No se ve claro"])
    assert report.deliver(report.build_report(DETECTION, review, FIRMS, [], None, WHEN)) is None
    assert (tmp_path / "alerta-det-prueba.json").exists()
    assert report.send_pending() == (0, 1)  # sigue sin app: queda pendiente
