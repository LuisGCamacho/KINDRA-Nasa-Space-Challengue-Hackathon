"""Pruebas de las funciones de calibración con tablas chicas armadas a mano."""

import pandas as pd
import pytest

from kindra.ml import calibration as cal


def _points(rows):
    return pd.DataFrame(rows, columns=["lat", "lon", "day", "sat"]).assign(day=lambda d: pd.to_datetime(d.day))


def test_cell_index_no_se_corre_por_redondeo():
    # 0.3 / 0.1 da 2.9999999999999996 en coma flotante; debe caer en la celda 3.
    assert cal.cell_index(pd.Series([0.3]), 0.1).iloc[0] == 3


def test_solar_hour_suma_una_hora_cada_15_grados():
    hours = cal.solar_hour(pd.Series(["1800", "0130"]), pd.Series([-60.0, 15.0]))
    assert hours.tolist() == pytest.approx([14.0, 2.5])


def test_celdas_dia_cuentan_una_vez_por_satelite_celda_y_dia():
    clean = _points([
        (-29.11, -67.41, "2015-07-01", "Aqua"),
        (-29.12, -67.42, "2015-07-01", "SNPP"),
        (-29.13, -67.43, "2015-07-01", "SNPP"),  # misma celda y día: no suma
        (-29.13, -67.43, "2015-07-02", "SNPP"),  # otro día: suma
    ])
    counts = cal.monthly_cell_days(clean, res=0.1)
    assert counts[["year", "month", "a", "v"]].values.tolist() == [[2015, 7, 1, 2]]


def test_clean_fires_filtra_confianza_tipo_y_satelite():
    fires = pd.DataFrame({
        "lat": [-30.0] * 4, "lon": [-60.0] * 4, "day": pd.to_datetime(["2015-01-01"] * 4),
        "utc_hhmm": ["1730"] * 4,
        "satellite": ["Aqua", "Aqua", "N", "N"],
        "instrument": ["MODIS", "MODIS", "VIIRS", "VIIRS"],
        "confidence": ["80", "10", "h", "l"],
        "daynight": ["D"] * 4, "type": ["0", "0", "0", "0"],
    })
    clean = cal.clean_fires(fires, modis_min_confidence=30)
    assert clean["sat"].tolist() == ["Aqua", "SNPP"]


def test_fit_k_mensual_y_unico():
    train = pd.DataFrame({"year": [2015, 2015], "month": [1, 7], "a": [10, 30], "v": [100, 100]})
    assert cal.fit_k(train, "mensual")[[1, 7]].tolist() == pytest.approx([0.1, 0.3])
    assert cal.fit_k(train, "único").unique().tolist() == pytest.approx([0.2])


def test_evaluate_sin_error_cuando_k_es_constante():
    counts = pd.DataFrame({"year": [2015, 2016, 2017], "month": [7, 7, 7],
                           "a": [20, 40, 60], "v": [100, 200, 300]})
    metrics = cal.evaluate(cal.leave_one_year_out(counts, [2015, 2016, 2017]), "mensual")
    assert metrics["MAE mensual (celdas-día)"] == pytest.approx(0)
