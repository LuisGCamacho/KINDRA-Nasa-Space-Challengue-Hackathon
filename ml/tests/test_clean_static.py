"""Los focos NRT sobre una fuente fija conocida (`type = 2` en el dato definitivo) no cuentan."""

import pandas as pd

from kindra.pipeline.clean import on_static_source, static_points


def test_nrt_sobre_refineria_conocida_se_marca_y_el_campo_de_al_lado_no():
    fires = pd.DataFrame({  # dato definitivo: una refinería y un fuego de vegetación
        "lat": [33.8571, 34.5000], "lon": [-118.2301, -118.1000], "type": ["2", "0"]})
    kept = pd.DataFrame({  # NRT: otra pasada sobre la refinería, y un foco a ~5 km
        "lat": [33.8590, 33.9000], "lon": [-118.2280, -118.2300]}, index=[10, 11])

    assert on_static_source(kept["lat"], kept["lon"], static_points(fires)).to_dict() == {10: True, 11: False}


def test_sin_fuentes_fijas_no_marca_nada():
    fires = pd.DataFrame({"lat": [34.0], "lon": [-118.0], "type": [None]})
    kept = pd.DataFrame({"lat": [34.0], "lon": [-118.0]})
    assert not on_static_source(kept["lat"], kept["lon"], static_points(fires)).any()
