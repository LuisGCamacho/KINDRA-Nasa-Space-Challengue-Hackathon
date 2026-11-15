"""Pruebas de la validación y del modelo de próximas 24 h, sin descargar nada."""

import pandas as pd
import pytest

from kindra.ml import features, predict, validation


def _fires(rows):
    return pd.DataFrame(rows, columns=["i", "j", "day"]).assign(day=lambda d: pd.to_datetime(d.day))


def test_historia_propia_cuenta_ventanas_de_1_3_y_7_dias():
    history = features.own_history(_fires([(1, 1, "2024-08-01"), (1, 1, "2024-08-05"), (1, 1, "2024-08-07")]))
    row = history[history["day"] == "2024-08-07"].iloc[0]
    assert (row.fires_1d, row.fires_3d, row.fires_7d) == (1, 2, 3)


def test_viento_del_norte_mira_la_vecina_del_norte():
    di, dj = features.upwind_offset(pd.Series([0.0, 90.0, 180.0]))
    assert list(zip(di, dj)) == [(1, 0), (0, 1), (-1, 0)]


def test_tabla_completa_con_objetivo_y_viento():
    fires = _fires([(406, -1225, "2024-08-01"), (407, -1225, "2024-08-01"), (406, -1225, "2024-08-02")])
    clat, clon = 40.65, -122.45  # centro de la celda (406, -1225) en la grilla de 0,1°, en Shasta
    weather = pd.DataFrame({"clat": [clat], "clon": [clon], "date": pd.to_datetime(["2024-08-01"]),
                            "ws10m": [5.0], "wd10m": [0.0], "t2m": [20.0], "rh2m": [30.0]})
    table = features.build_features(fires, weather)
    row = table[(table["i"] == 406) & (table["j"] == -1225) & (table["day"] == "2024-08-01")].iloc[0]
    assert row.fire_tomorrow == 1  # la celda tuvo fuego el 2 de agosto
    assert row.neigh_3d == 1 and row.downwind_3d == 1  # la vecina del norte tenía fuego y el viento venía de ahí


def test_pronostico_de_zona_combina_las_celdas():
    cells = pd.DataFrame({"p": [0.5, 0.5], "fires_3d": [3, 3]})
    result = predict.zone_forecast(cells)
    assert result["p"] == pytest.approx(0.75)
    assert result["trend"] == "baja"  # 1 celda esperada contra 2 por día en los últimos 3 días
    assert result["expected"][0] <= 1 <= result["expected"][1]


def test_salto_2012_y_contrato_de_validation_json():
    months = [f"{year}-07" for year in range(2009, 2015)]
    series = pd.DataFrame({"t": months, "raw": [10, 10, 10, 50, 50, 50], "harm": [10, 10, 10, 11, 11, 11]})
    step = validation.step_change(series)
    assert step == {"raw": 400.0, "harm": 10.0}

    payload = validation.validation_payload(step, {})
    names = [item["name"] for item in payload["items"]]
    assert names == ["salto_2012_crudo", "salto_2012_armonizado", "holdout_mae_pct", "holdout_r"]
    assert payload["items"][2]["value"] is None  # sin holdout calculado queda pendiente
