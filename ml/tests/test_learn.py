"""Pruebas de los registros de falsos positivos, con la cola en una carpeta temporal."""

import json

from kindra.agent import learn
from kindra.contracts import Box, Detection, FireRegion, ModelInfo


def detection(label="humo", confidence=0.9):
    return Detection(
        id="det-1", camera_id="caltrans-d2-sugarloaf", captured_at="2026-11-15T18:00:00Z",
        frame_url="/live/frames/det-1.jpg", annotated_url="/live/frames/det-1-marcada.jpg",
        regions=[FireRegion(label=label, confidence=confidence, box=Box(x=0.1, y=0.1, w=0.2, h=0.2))],
        materials=[], model=ModelInfo(name="prueba", version="0"),
    )


def test_diagnostico_por_reglas():
    assert learn.rule_diagnosis(detection("anomalia", 0.5), None).suggestion.kind == "regla"
    assert learn.rule_diagnosis(detection("humo", 0.4), None).suggestion.kind == "umbral"
    strong = learn.rule_diagnosis(detection("humo", 0.9), "Era una nube baja")
    assert strong.probable_cause == "Marcado por una persona: Era una nube baja"


def test_si_el_llm_falla_se_usan_las_reglas():
    def broken(_detection, _note):
        raise TimeoutError("sin respuesta")

    assert learn.diagnose_safely(detection("anomalia"), None, broken).suggestion.kind == "regla"


def test_la_cola_se_procesa_una_sola_vez(tmp_path, monkeypatch):
    live, logs = tmp_path / "live", tmp_path / "fp"
    monkeypatch.setattr(learn, "QUEUE", live / "false-positive-queue.json")
    monkeypatch.setattr(learn, "ALERTS", live / "fire-alerts.json")
    monkeypatch.setattr(learn, "DETECTIONS", live / "detections")
    monkeypatch.setattr(learn, "DONE", logs / "procesadas.json")
    monkeypatch.setattr(learn, "FALSE_POSITIVE_LOGS", logs)
    (live / "detections").mkdir(parents=True)
    (live / "false-positive-queue.json").write_text(json.dumps([{"alertId": "alerta-det-1", "note": "Nube"}]))
    (live / "fire-alerts.json").write_text(json.dumps([{"id": "alerta-det-1", "detectionId": "det-1"}]))
    (live / "detections" / "det-1.json").write_text(json.dumps(detection().to_json()))

    first = learn.process_queue()
    assert len(first) == 1 and first[0].human_note == "Nube" and first[0].alert_id == "alerta-det-1"
    assert len(list(logs.glob("fp-*.json"))) == 1
    assert learn.process_queue() == []  # la segunda pasada no repite
