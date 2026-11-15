"""`python -m kindra validate`: prueba con números que la armonización funciona.

Escribe `web/data/validation.json` con los mismos nombres de ítems que ya usa la app:

- Salto de 2012 en la serie cruda y en la armonizada. VIIRS empieza en 2012 y ve muchos más focos
  que MODIS: si la armonización sirve, el salto aparece en la suma directa y desaparece en la serie
  armonizada.
- Holdout: el factor calibrado en 2012–2021 predice Aqua en 2022–2025 desde VIIRS, años que la
  calibración no vio.
"""

from __future__ import annotations

import pandas as pd

from kindra.config import CALIBRATION_YEARS, HOLDOUT_YEARS
from kindra.ml.calibration import evaluate, train_test
from kindra.pipeline.harmonize import pair_counts

BEFORE = (2009, 2011)  # tres años solo con MODIS
AFTER = (2012, 2014)  # tres años con VIIRS


def step_change(series: pd.DataFrame) -> dict[str, float]:
    """Cambio (%) del promedio anual de 2009–2011 a 2012–2014, en la serie cruda y en la armonizada.

    Args:
        series: Serie mensual de una zona (por ejemplo, California) con `t`, `raw` y `harm`.

    Returns:
        `{"raw": %, "harm": %}`, redondeados a un decimal.
    """
    yearly = series.assign(year=series["t"].str[:4].astype(int)).groupby("year")[["raw", "harm"]].sum()
    before = yearly.loc[BEFORE[0]:BEFORE[1]].mean()
    after = yearly.loc[AFTER[0]:AFTER[1]].mean()
    return ((after / before - 1) * 100).round(1).to_dict()


def holdout(cell_days: pd.DataFrame) -> dict[str, float]:
    """Calibra el factor mensual en 2012–2021 y mide qué tan bien predice Aqua en 2022–2025.

    Args:
        cell_days: Celdas-día de `grid.to_cell_days` con Aqua y Suomi NPP.

    Returns:
        Las métricas de `calibration.evaluate`: MAE mensual, error anual (%) y `r`.
    """
    counts = pair_counts(cell_days, "SNPP")
    return evaluate(train_test(counts, CALIBRATION_YEARS, HOLDOUT_YEARS), "mensual")


def validation_payload(step: dict[str, float], test: dict[str, float]) -> dict:
    """Arma `validation.json`: `{ items: [{ name, value, detail }] }`.

    Los valores que no se calcularon quedan en `null`, y la app los muestra como «pendiente».
    """
    calibration = years_label(CALIBRATION_YEARS.start, CALIBRATION_YEARS.stop - 1)
    proof = years_label(HOLDOUT_YEARS.start, HOLDOUT_YEARS.stop - 1)
    jump = {"unidad": "%", "antes": years_label(*BEFORE), "despues": years_label(*AFTER)}
    return {"items": [
        {"name": "salto_2012_crudo", "value": rounded(step.get("raw")), "detail": {**jump, "serie": "raw"}},
        {"name": "salto_2012_armonizado", "value": rounded(step.get("harm")), "detail": {**jump, "serie": "harm"}},
        {"name": "holdout_mae_pct", "value": rounded(test.get("error anual (%)")),
         "detail": {"unidad": "%", "calibracion": calibration, "prueba": proof}},
        {"name": "holdout_r", "value": rounded(test.get("r"), 3),
         "detail": {"calibracion": calibration, "prueba": proof}},
    ]}


def years_label(first: int, last: int) -> str:
    """Rango de años con raya: `2012–2021`."""
    return f"{first}–{last}"


def rounded(value: float | None, digits: int = 1) -> float | None:
    """Redondea, o devuelve `None` si el valor falta o no es un número."""
    return None if value is None or pd.isna(value) else round(float(value), digits)
