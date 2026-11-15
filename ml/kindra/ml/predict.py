"""`python -m kindra predict`: probabilidad de focos nuevos en las próximas 24 h por zona.

La probabilidad de la zona es la de que al menos una de sus celdas tenga fuego:
`p = 1 − Π(1 − p_celda)`. El rango esperado cuenta celdas con fuego (no píxeles), con un intervalo
del 90 %.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

import lightgbm as lgb
import numpy as np
import pandas as pd

from kindra.ml.features import FEATURES

Z_90 = 1.645  # intervalo del 90 % de una normal
TREND_BAND = 0.2  # ±20 % contra el promedio de los últimos 3 días se considera "estable"


def zone_forecast(cells: pd.DataFrame) -> dict:
    """Pronóstico de una zona a partir de la probabilidad de cada celda.

    El esperado es la suma de probabilidades (μ) y su dispersión la de una suma de Bernoulli
    independientes: `σ = √Σ p(1 − p)`.

    Args:
        cells: Celdas de la zona con `p` (probabilidad de fuego mañana) y `fires_3d`.

    Returns:
        `{ p, expected: [mínimo, máximo], trend }`, con `trend` en `sube`, `estable` o `baja`.
    """
    p = cells["p"].to_numpy()
    expected = p.sum()
    spread = Z_90 * math.sqrt(float((p * (1 - p)).sum()))
    recent = cells["fires_3d"].sum() / 3  # celdas con fuego por día, promedio de los últimos 3 días
    return {
        "p": round(float(1 - np.prod(1 - p)), 3),
        "expected": [max(0, math.floor(expected - spread)), math.ceil(expected + spread)],
        "trend": trend_of(expected, recent),
    }


def trend_of(expected: float, recent: float) -> str:
    """`sube` o `baja` si el esperado se aleja más de un 20 % del promedio reciente; si no, `estable`."""
    if expected > recent * (1 + TREND_BAND):
        return "sube"
    if expected < recent * (1 - TREND_BAND):
        return "baja"
    return "estable"


def forecast(model: lgb.Booster, today: pd.DataFrame, cell_zones: pd.DataFrame,
             metrics: dict, issued: datetime | None = None) -> dict:
    """Arma `forecast/latest.json`.

    Args:
        model: Modelo guardado por `train.py`.
        today: Filas de `features.build_features` del último día con datos.
        cell_zones: Salida de `zones.cell_zones` (alcance `ca`).
        metrics: Precisión, recall y AUC que guardó `train.py`.
        issued: Momento de emisión. Por defecto, ahora (UTC).

    Returns:
        `{ issued, zones: [{ zoneId, p, expected, trend }], metrics }`, de mayor a menor `p`.
    """
    cells = today.assign(p=model.predict(today[FEATURES]))
    cells = cells.merge(cell_zones[["i", "j", "zone_id"]], on=["i", "j"])
    zones = [{"zoneId": zone_id, **zone_forecast(group)} for zone_id, group in cells.groupby("zone_id")]
    zones.sort(key=lambda zone: zone["p"], reverse=True)
    issued = issued or datetime.now(timezone.utc)
    return {
        "issued": issued.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "zones": zones,
        "metrics": {name: metrics.get(name) for name in ("precision", "recall", "auc")},
    }
