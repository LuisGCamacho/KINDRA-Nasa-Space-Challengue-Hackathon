"""Pruebas del año en curso de `download_firms`: tramos SP sin duplicados y NRT reemplazado entero."""

from datetime import date

import pytest

from kindra.pipeline import download_firms as dl


def test_forward_chunks_start_on_the_same_day_every_run():
    """Los cortes salen del 1 de enero: un tramo ya bajado conserva su nombre al día siguiente."""
    assert dl.forward_chunks(date(2026, 1, 1), date(2026, 1, 12)) == [
        (date(2026, 1, 1), 5), (date(2026, 1, 6), 5), (date(2026, 1, 11), 2)]
    assert dl.forward_chunks(date(2026, 1, 2), date(2026, 1, 1)) == []


@pytest.fixture
def firms(tmp_path, monkeypatch):
    """FIRMS falso: anota cada pedido y responde un CSV con el encabezado; `fail` hace fallar una fuente."""
    monkeypatch.setattr(dl, "RAW", tmp_path / "raw")
    monkeypatch.setattr(dl, "INTERIM", tmp_path / "interim")
    monkeypatch.setenv("FIRMS_MAP_KEY", "clave-de-prueba")
    state = {"urls": [], "fail": None, "available": {}}

    def fake_save(url, target, crop_to=None):
        if state["fail"] and state["fail"] in url:
            raise dl.FirmsDownloadError("cuota agotada")
        state["urls"].append(url)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("latitude,longitude\n", encoding="utf-8")

    monkeypatch.setattr(dl, "save_csv", fake_save)
    monkeypatch.setattr(dl, "availability", lambda key: state["available"])
    return state


def test_current_year_takes_final_data_then_provisional_until_today(firms):
    firms["available"] = {"MODIS_SP": (date(2000, 11, 1), date(2026, 1, 7)),
                          "MODIS_NRT": (date(2026, 1, 1), date(2026, 1, 12))}
    assert dl.current_year(date(2026, 1, 10)) == []

    sp = sorted(p.name for p in (dl.RAW / "modis").iterdir())
    nrt = sorted(p.name for p in (dl.RAW / "nrt").iterdir())
    assert sp == ["MODIS_SP_2026-01-01_5d.csv", "MODIS_SP_2026-01-06_2d.csv"]
    assert nrt == ["MODIS_NRT_2026-01-08_3d.csv"]  # del día siguiente al SP hasta hoy, sin pasarse


def test_longer_final_chunk_replaces_the_short_one(firms):
    """Si FIRMS publicó más días SP, el tramo corto se borra: si quedaran los dos habría días dobles."""
    firms["available"] = {"MODIS_SP": (date(2000, 11, 1), date(2026, 1, 7))}
    dl.current_year(date(2026, 1, 10))
    firms["available"] = {"MODIS_SP": (date(2000, 11, 1), date(2026, 1, 9))}
    firms["urls"].clear()
    dl.current_year(date(2026, 1, 10))

    assert sorted(p.name for p in (dl.RAW / "modis").iterdir()) == [
        "MODIS_SP_2026-01-01_5d.csv", "MODIS_SP_2026-01-06_4d.csv"]
    assert len(firms["urls"]) == 1  # el tramo completo del 1 de enero no se volvió a pedir


def test_provisional_is_replaced_and_kept_when_a_download_fails(firms):
    firms["available"] = {"MODIS_SP": (date(2000, 11, 1), date(2026, 1, 5)),
                          "MODIS_NRT": (date(2026, 1, 1), date(2026, 1, 10))}
    dl.current_year(date(2026, 1, 10))
    firms["available"]["MODIS_SP"] = (date(2000, 11, 1), date(2026, 1, 7))
    dl.current_year(date(2026, 1, 10))
    assert sorted(p.name for p in (dl.RAW / "nrt").iterdir()) == ["MODIS_NRT_2026-01-08_3d.csv"]

    firms["fail"] = "MODIS_NRT"
    failures = dl.current_year(date(2026, 1, 10))
    assert failures and "cuota agotada" in failures[0]
    assert sorted(p.name for p in (dl.RAW / "nrt").iterdir()) == ["MODIS_NRT_2026-01-08_3d.csv"]
    assert not any((dl.INTERIM).glob("bajando-*"))


def test_current_year_needs_the_key(firms, monkeypatch):
    monkeypatch.delenv("FIRMS_MAP_KEY")
    with pytest.raises(RuntimeError, match="FIRMS_MAP_KEY"):
        dl.current_year(date(2026, 1, 10))
