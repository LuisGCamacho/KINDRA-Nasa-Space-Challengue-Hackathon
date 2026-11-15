"""Pruebas del recorrido del agente con satélite, cámara, detector y Gemini falsos."""

from datetime import datetime, timezone

import numpy as np
import pandas as pd
import pytest

from kindra.agent import pipeline, report, supervisor
from kindra.contracts import AgentReview, Box, FireRegion, ModelInfo

NOW = datetime(2026, 11, 15, 20, 0, tzinfo=timezone.utc)  # 12:00 en California: de día
NIGHT = datetime(2026, 11, 16, 8, 0, tzinfo=timezone.utc)  # 00:00 en California
CAMERA = {"id": "caltrans-d2-sugarloaf", "name": "Sugarloaf", "provider": "caltrans",
          "position": [-122.4, 40.7], "imageUrl": "https://x/sugarloaf.jpg", "refreshSeconds": 300}
SMOKE = FireRegion(label="humo", confidence=0.8, box=Box(x=0.4, y=0.3, w=0.2, h=0.2))


def firms_rows(lon=-122.38, lat=40.71, when="2026-11-15", hhmm=1800):
    return pd.DataFrame({"latitude": [lat], "longitude": [lon], "acq_date": [when], "acq_time": [hhmm],
                         "source": ["VIIRS_NOAA20_NRT"]})


class FakeDetector:
    info = ModelInfo(name="prueba", version="0")

    def __init__(self, regions):
        self.regions = regions

    def detect(self, image, night=None):
        return [] if night else list(self.regions)


@pytest.fixture
def world(tmp_path, monkeypatch):
    """Carpetas temporales, una cámara, FIRMS con un foco y un Gemini que confirma."""
    for name, value in {"SEEN": tmp_path / "vistos.json", "LAST_ALERT": tmp_path / "ultima.json",
                        "DETECTIONS": tmp_path / "det", "TRACKS": tmp_path / "tracks", "FRAMES": tmp_path / "frames",
                        "HOTSPOTS": tmp_path / "focos"}.items():
        monkeypatch.setattr(pipeline, name, value)
    monkeypatch.setenv("FIRMS_MAP_KEY", "prueba")
    monkeypatch.setattr(pipeline.cameras, "load_cameras", lambda: [CAMERA])
    monkeypatch.setattr(pipeline.cameras, "fetch_recent_frames",
                        lambda camera, count: [np.full((260, 320, 3), 90, np.uint8) for _ in range(count)])
    monkeypatch.setattr(pipeline.firms_nrt, "hotspots", lambda key, source, area:
                        firms_rows() if source == "VIIRS_NOAA20_NRT" else firms_rows().iloc[0:0])
    monkeypatch.setattr(pipeline.materials, "osm_materials", lambda position: [])
    monkeypatch.setattr(pipeline.water, "water_sources", lambda position: [])
    sent = []
    monkeypatch.setattr(report, "deliver", lambda built: sent.append(built) or {"ok": True})
    monkeypatch.setattr(supervisor, "supervise", lambda evidence, jpeg, name: supervisor.Verdict(
        AgentReview(decision="confirmar", confidence=0.9, reasons=["Humo"]),
        report.template_draft(name, evidence.detection, evidence.firms)))
    return sent


def test_foco_nuevo_con_humo_manda_alerta_una_vez(world):
    tools = pipeline.Tools(fire=FakeDetector([SMOKE]))
    first = pipeline.run_cycle(tools, NOW)
    assert [o.result for o in first] == ["Gemini: confirmar"] and len(world) == 1
    assert world[0].draft is not None and world[0].alert.firms.found
    assert (pipeline.DETECTIONS / "por-id" / f"{world[0].detection.id}.json").exists()
    assert (pipeline.TRACKS / "caltrans-d2-sugarloaf.json").exists()
    assert pipeline.run_cycle(tools, NOW) == [] and len(world) == 1  # el mismo foco no se repite


def test_camara_sin_humo_no_alerta(world):
    outcomes = pipeline.run_cycle(pipeline.Tools(fire=FakeDetector([])), NOW)
    assert "no ve humo" in outcomes[0].result and world == []


def test_de_noche_queda_para_revisar_sin_correo(world, monkeypatch):
    monkeypatch.setattr(pipeline.firms_nrt, "hotspots", lambda key, source, area:
                        firms_rows(when="2026-11-16", hhmm=600) if source == "VIIRS_NOAA20_NRT" else firms_rows().iloc[0:0])
    outcomes = pipeline.run_cycle(pipeline.Tools(fire=FakeDetector([SMOKE])), NIGHT)
    assert outcomes[0].result == "De noche: queda para revisar"
    assert world[0].alert.agent.decision == "revisar" and world[0].draft is None


def test_foco_lejos_de_las_camaras_solo_se_anota(world, monkeypatch):
    monkeypatch.setattr(pipeline.firms_nrt, "hotspots", lambda key, source, area:
                        firms_rows(lon=-121.9) if source == "VIIRS_NOAA20_NRT" else firms_rows().iloc[0:0])
    outcomes = pipeline.run_cycle(pipeline.Tools(fire=FakeDetector([SMOKE])), NOW)
    assert outcomes == [pipeline.Outcome(None, 1, "Sin cámara cerca: solo se anota")] and world == []


def test_misma_camara_no_alerta_dos_veces_seguidas(world, monkeypatch):
    tools = pipeline.Tools(fire=FakeDetector([SMOKE]))
    pipeline.run_cycle(tools, NOW)
    monkeypatch.setattr(pipeline.firms_nrt, "hotspots", lambda key, source, area:
                        firms_rows(hhmm=1900) if source == "VIIRS_NOAA20_NRT" else firms_rows().iloc[0:0])
    outcomes = pipeline.run_cycle(tools, NOW)
    assert "Ya alertada" in outcomes[0].result and len(world) == 1


def test_la_camara_de_demo_no_se_vigila(world, monkeypatch):
    demo = {"id": "demo-video", "name": "Demo", "provider": "demo", "position": [-67.5, -29.2],
            "imageUrl": "/demo/incendio-demo.jpg", "refreshSeconds": 0}
    areas = []
    monkeypatch.setattr(pipeline.cameras, "load_cameras", lambda: [CAMERA, demo])
    monkeypatch.setattr(pipeline.firms_nrt, "hotspots", lambda key, source, area: areas.append(area) or firms_rows().iloc[0:0])
    pipeline.run_cycle(pipeline.Tools(fire=FakeDetector([SMOKE])), NOW)
    assert all(float(area.split(",")[1]) > 40 for area in areas)  # el recuadro no baja hasta Argentina
