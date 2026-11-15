"""Pruebas del cliente de NASA POWER sin conexión a internet."""

import math

import pandas as pd
import pytest
import requests

from kindra.ml import power


def test_snap_lleva_el_punto_al_centro_de_la_celda_power():
    assert power.snap(40.66, -122.40) == (40.5, -122.5)
    assert power.snap(40.80, -122.70) == (41.0, -122.5)


def test_snap_desempata_siempre_hacia_arriba():
    # 40.25 y 40.75 quedan justo entre dos celdas POWER de 0,5°.
    assert power.snap(40.25, -122.45)[0] == 40.5
    assert power.snap(40.75, -122.45)[0] == 41.0


class _FakeResponse:
    status_code = 200

    def raise_for_status(self):
        pass

    def json(self):
        return {"properties": {"parameter": {k: {"20260713": 1.0} for k in power.PARAMETERS}}}


def test_daily_reintenta_tras_un_corte_de_red(monkeypatch):
    calls = []

    def fake_get(*args, **kwargs):
        calls.append(1)
        if len(calls) == 1:
            raise requests.ConnectionError("sin red")
        return _FakeResponse()

    monkeypatch.setattr(power.requests, "get", fake_get)
    monkeypatch.setattr(power.time, "sleep", lambda s: None)
    df = power.daily(40.5, -122.5, "2026-07-13", "2026-07-13")
    assert len(calls) == 2
    assert len(df) == 1


def test_daily_lanza_el_ultimo_error_si_se_agotan_los_intentos(monkeypatch):
    def fake_get(*args, **kwargs):
        raise requests.Timeout("sin respuesta")

    monkeypatch.setattr(power.requests, "get", fake_get)
    monkeypatch.setattr(power.time, "sleep", lambda s: None)
    with pytest.raises(requests.Timeout):
        power.daily(40.5, -122.5, "2026-07-13", "2026-07-13", attempts=3)


def test_parse_convierte_fechas_y_marca_sin_dato():
    payload = {"properties": {"parameter": {
        "WS10M": {"20260712": 3.1, "20260713": -999.0},
        "WD10M": {"20260712": 270.0, "20260713": 90.0},
        "T2M": {"20260712": 12.5, "20260713": 14.0},
        "RH2M": {"20260712": 30.0, "20260713": 25.0},
    }}}
    df = power.parse(payload)
    assert list(df.columns) == ["date", "ws10m", "wd10m", "t2m", "rh2m"]
    assert df.date.iloc[0] == pd.Timestamp("2026-07-12")
    assert math.isnan(df.ws10m.iloc[1])
