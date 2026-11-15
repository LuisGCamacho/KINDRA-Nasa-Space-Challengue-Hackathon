"""Pruebas del pipeline de armonización con tablas chicas armadas a mano."""

import pandas as pd
import pytest

from kindra.pipeline import aggregate, harmonize, reference


def _days(rows):
    return pd.DataFrame(rows, columns=["sat", "day"]).assign(day=lambda d: pd.to_datetime(d.day))


def test_satelite_de_referencia_cambia_en_las_fechas_acordadas():
    days = pd.Series(pd.to_datetime(["2002-07-04", "2002-07-05", "2012-01-20", "2012-01-21",
                                      "2026-11-02", "2026-11-03"]))
    assert reference.reference_satellite(days).tolist() == ["Terra", "Aqua", "Aqua", "SNPP", "SNPP", "NOAA20"]


def test_viirs_se_lleva_a_escala_modis_y_modis_vale_uno():
    days = _days([("Aqua", "2010-07-01"), ("SNPP", "2015-07-01")]).assign(region="ca")
    factors = pd.DataFrame([{"region": "ca", "sat": "SNPP", "month": 7, "k": 0.2, "k_low": 0.15, "k_high": 0.25}])
    weighted = harmonize.weights(days, factors)
    assert weighted["w"].tolist() == pytest.approx([1.0, 0.2])
    assert weighted["w_hi"].tolist() == pytest.approx([1.0, 0.25])


def test_falta_un_factor_es_un_error_y_no_un_cero():
    days = _days([("SNPP", "2015-08-01")]).assign(region="ca")
    factors = pd.DataFrame([{"region": "ca", "sat": "SNPP", "month": 7, "k": 0.2, "k_low": 0.1, "k_high": 0.3}])
    with pytest.raises(ValueError, match="Faltan factores"):
        harmonize.weights(days, factors)


def test_serie_mensual_sin_huecos_y_viirs_null_antes_de_2012():
    rows = _days([("Aqua", "2011-12-10"), ("SNPP", "2012-02-10"), ("Aqua", "2012-02-10")])
    rows = rows.assign(zone_id="us-ca-shasta", nrt=False, is_reference=[True, True, False],
                       w=[1.0, 0.2, None], w_lo=[1.0, 0.1, None], w_hi=[1.0, 0.3, None])
    series = aggregate.monthly_series(rows, "2011-12", "2012-02", open_month="2012-02").set_index("t")

    assert series.index.tolist() == ["2011-12", "2012-01", "2012-02"]
    assert pd.isna(series.loc["2011-12", "viirs"])
    assert series.loc["2012-01", "raw"] == 0
    assert series.loc["2012-02", "raw"] == 2  # suma directa de los dos satélites
    assert series.loc["2012-02", "harm"] == pytest.approx(0.2)  # solo la referencia, en escala MODIS
    assert series.loc["2012-02", "modis"] == 1 and series.loc["2012-02", "viirs"] == 1
    assert series.loc["2012-02", "src"] == "VIIRS_SNPP"
    assert bool(series.loc["2012-02", "partial"]) and not bool(series.loc["2012-01", "partial"])


def test_factor_de_noaa20_solo_usa_los_anos_en_que_volaba():
    rows = [("Aqua", f"{year}-07-01") for year in range(2012, 2022)]
    rows += [("NOAA20", f"{year}-07-01") for year in range(2018, 2022)]
    rows += [("SNPP", f"{year}-07-0{d}") for year in range(2012, 2022) for d in (1, 2)]
    factors = harmonize.region_factors(_days(rows), "ca").set_index("sat")
    assert factors.loc["NOAA20", "n_years"] == 4
    assert factors.loc["SNPP", "k"] == pytest.approx(0.5)


def test_zona_raiz_sale_con_parent_null_y_no_nan():
    import json

    import geopandas as gpd
    from shapely.geometry import box

    from kindra.pipeline.zones import zone_records

    zones = gpd.GeoDataFrame(
        {"id": ["us-ca", "us-ca-shasta"], "name": ["California", "Shasta"],
         "type": ["provincia", "departamento"], "parent": [None, "us-ca"],
         "country": ["Estados Unidos"] * 2},
        geometry=[box(-124, 32, -114, 42), box(-123, 40, -121, 41)], crs=4326,
    )
    records = zone_records(zones)
    assert records[0]["parent"] is None
    json.dumps(records, allow_nan=False)  # falla si queda algún NaN


def test_write_json_rechaza_nan(tmp_path):
    import pytest

    from kindra.live_paths import write_json

    with pytest.raises(ValueError):
        write_json(tmp_path / "x.json", {"parent": float("nan")})
    assert not (tmp_path / "x.json").exists()  # no deja un archivo a medias
