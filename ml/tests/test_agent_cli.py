"""Pruebas de los comandos del agente, sin modelos ni red."""

from typer.testing import CliRunner

from kindra.__main__ import app
from kindra.agent import firms_nrt, learn, pipeline, report

runner = CliRunner()


def test_watch_una_vez_muestra_lo_que_paso(monkeypatch):
    monkeypatch.setattr(pipeline.Tools, "load", classmethod(lambda cls: None))
    monkeypatch.setattr(report, "send_pending", lambda: (1, 0))
    monkeypatch.setattr(pipeline, "run_cycle", lambda tools, now: [pipeline.Outcome(None, 3, "Sin cámara cerca: solo se anota")])
    result = runner.invoke(app, ["agent", "watch", "--once"])
    assert result.exit_code == 0 and "Outbox: 1 enviados" in result.output and "sin cámara: 3 focos" in result.output


def test_watch_sigue_si_firms_falla(monkeypatch):
    monkeypatch.setattr(pipeline.Tools, "load", classmethod(lambda cls: None))
    monkeypatch.setattr(report, "send_pending", lambda: (0, 0))

    def down(tools, now):
        raise firms_nrt.FirmsError("sin respuesta")

    monkeypatch.setattr(pipeline, "run_cycle", down)
    result = runner.invoke(app, ["agent", "watch", "--once"])
    assert result.exit_code == 0 and "FIRMS no respondió" in result.output


def test_learn_sin_cola(monkeypatch):
    monkeypatch.setattr(learn, "process_queue", lambda: [])
    result = runner.invoke(app, ["agent", "learn"])
    assert result.exit_code == 0 and "0 falsos positivos" in result.output
