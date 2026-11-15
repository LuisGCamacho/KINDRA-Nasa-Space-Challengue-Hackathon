"""`python -m kindra train`: entrena LightGBM con años viejos y lo mide con los recientes.

El modelo responde "¿mañana habrá fuego en esta celda?" para las celdas de California que tuvieron
fuego en los últimos 7 días (ver `features.py`).
"""

from __future__ import annotations

import json
from pathlib import Path

import lightgbm as lgb
import pandas as pd
from sklearn.metrics import brier_score_loss, precision_score, recall_score, roc_auc_score

from kindra.ml.features import FEATURES, TARGET

# Desde 2012 la referencia es VIIRS, que ve unas 3 veces más celdas-día que MODIS: mezclar las dos
# épocas cambiaría qué significa "fuego mañana" a mitad de la tabla.
FIRST_TRAIN_YEAR = 2012
LAST_TRAIN_YEAR = 2023  # entrena 2012–2023 y prueba 2024–2025: nunca con datos del futuro
THRESHOLD = 0.5  # probabilidad desde la que se cuenta "habrá fuego" para precisión y recall


def train(table: pd.DataFrame, model_path: Path, metrics_path: Path) -> dict[str, float]:
    """Entrena, mide y guarda el modelo y sus métricas.

    Args:
        table: Salida de `features.build_features`.
        model_path: Archivo del modelo (formato texto de LightGBM).
        metrics_path: JSON con las métricas de la prueba.

    Returns:
        Las métricas de `metrics`, más los años y las filas usados.

    Raises:
        ValueError: Si el entrenamiento o la prueba no tienen los dos casos (con y sin fuego mañana).
    """
    train_rows, test_rows = split_by_year(table)
    for name, rows in (("entrenamiento", train_rows), ("prueba", test_rows)):
        if rows[TARGET].nunique() < 2:
            raise ValueError(f"El {name} necesita días con y sin fuego al día siguiente")

    # Sin `class_weight="balanced"` del tutorial: ese peso infla las probabilidades, y `predict.py`
    # las suma (celdas esperadas) y las combina (p de la zona), así que tienen que ser reales.
    model = lgb.LGBMClassifier(n_estimators=500, learning_rate=0.05, num_leaves=31, verbose=-1)
    model.fit(train_rows[FEATURES], train_rows[TARGET])
    result = metrics(test_rows[TARGET], model.predict_proba(test_rows[FEATURES])[:, 1])
    result.update(
        train_years=f"{FIRST_TRAIN_YEAR}–{LAST_TRAIN_YEAR}",
        test_years=f"{LAST_TRAIN_YEAR + 1}–{int(test_rows['day'].dt.year.max())}",
        train_rows=len(train_rows), test_rows=len(test_rows),
    )

    model_path.parent.mkdir(parents=True, exist_ok=True)
    model.booster_.save_model(str(model_path))
    metrics_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result


def split_by_year(table: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Parte en (entrenamiento, prueba) por año, no al azar: días vecinos se parecen demasiado."""
    years = table["day"].dt.year
    return table[years.between(FIRST_TRAIN_YEAR, LAST_TRAIN_YEAR)], table[years > LAST_TRAIN_YEAR]


def metrics(truth: pd.Series, probability) -> dict[str, float]:
    """Métricas de la prueba, redondeadas a 3 decimales.

    `precision`, `recall` y `auc` van a `forecast/latest.json`. `brier` (error cuadrático de la
    probabilidad, 0 es perfecto) y `base_rate` (fracción real de días con fuego mañana) sirven para
    ver si las probabilidades están bien calibradas.
    """
    predicted = probability >= THRESHOLD
    return {
        "precision": round(float(precision_score(truth, predicted, zero_division=0)), 3),
        "recall": round(float(recall_score(truth, predicted, zero_division=0)), 3),
        "auc": round(float(roc_auc_score(truth, probability)), 3),
        "brier": round(float(brier_score_loss(truth, probability)), 3),
        "base_rate": round(float(truth.mean()), 3),
    }
