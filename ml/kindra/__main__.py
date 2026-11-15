"""Comandos de KINDRA: `python -m kindra download | build | validate | train | predict | export | load | agent`.

Orden de una corrida completa: download -> build -> validate -> train -> predict -> export -> load.
`agent` (watch | demo | learn) es aparte: el agente de cámaras, en `kindra/agent/cli.py`.
Cada comando importa sus módulos adentro, para que `--help` sea rápido y un módulo que todavía
falta (por ejemplo `train.py`) no rompa los demás comandos.
"""

from __future__ import annotations

import json

import pandas as pd
import typer

from kindra.agent.cli import agent_app
from kindra.config import INTERIM, MODELS, SCOPES, WEB_DATA
from kindra.live_paths import read_json, write_json

app = typer.Typer(help="Pipeline de KINDRA: datos, armonización y próximas 24 h.", no_args_is_help=True)
app.add_typer(agent_app, name="agent")

REGION_SCOPE = "ca"  # grilla fina de California (0,1°): la que usan las zonas y el pronóstico
REGION_ZONE_ID = "us-ca"  # zona provincia California, para la prueba del salto de 2012
MODEL = MODELS / "forecast.txt"
METRICS = MODELS / "forecast_metrics.json"


@app.command()
def download(last_year: int = 2025, recent_days: int = 10) -> None:
    """CSV anuales de FIRMS recortados a California y los últimos días desde la API NRT."""
    from kindra.pipeline import download_firms

    for failure in download_firms.yearly(last_year):
        typer.echo(f"No se pudo bajar: {failure}. Bajarlo a mano desde FIRMS Archive Download.")
    try:
        download_firms.recent(recent_days)
    except RuntimeError as error:  # sin FIRMS_MAP_KEY: el archivo histórico sirve igual
        typer.echo(f"Se saltan los días recientes: {error}")


@app.command()
def build(last_day: str = typer.Option(None, help="YYYY-MM-DD. Por defecto, el último día de los CSV.")) -> None:
    """De los CSV de FIRMS a los Parquet de ml/data/interim/."""
    from kindra.pipeline.build import build as run_build

    run_build(last_day)


@app.command()
def validate() -> None:
    """Salto de 2012 y holdout 2022–2025 -> web/data/validation.json."""
    from kindra.ml import validation

    step = validation.step_change(region_series())
    test = validation.holdout(pd.read_parquet(INTERIM / f"cell_days_{REGION_SCOPE}.parquet"))
    write_json(WEB_DATA / "validation.json", validation.validation_payload(step, test))
    typer.echo(f"Salto 2012: {step} · holdout: {test}")


@app.command()
def train() -> None:
    """Entrena el modelo de próximas 24 h y guarda sus métricas."""
    from kindra.ml.train import train as run_train

    table = features()
    table.to_parquet(INTERIM / "features.parquet", index=False)
    typer.echo(run_train(table, MODEL, METRICS))


@app.command()
def predict() -> None:
    """Pronóstico del último día con datos -> web/data/forecast/latest.json."""
    import lightgbm as lgb

    from kindra.ml.predict import forecast
    from kindra.ml.train import last_data_day

    table = features()
    # El último día con datos, no el último de la tabla: las filas siguientes son historia arrastrada.
    today = table[table["day"] == last_data_day(table)]
    payload = forecast(lgb.Booster(model_file=str(MODEL)), today,
                       pd.read_parquet(INTERIM / f"cell_zones_{REGION_SCOPE}.parquet"), read_json(METRICS, {}))
    write_json(WEB_DATA / "forecast" / "latest.json", payload)


@app.command()
def export() -> None:
    """Parquet de interim -> JSON de web/data/ (zonas, series, celdas y factores)."""
    from kindra.pipeline.aggregate import all_months
    from kindra.pipeline.export import export_all

    period = read_json(INTERIM / "period.json", None)
    if period is None:
        raise typer.BadParameter("Falta ml/data/interim/period.json: correr antes `python -m kindra build`.")
    export_all(
        WEB_DATA,
        zones=json.loads((INTERIM / "zones.json").read_text(encoding="utf-8")),
        series=pd.read_parquet(INTERIM / "monthly_series.parquet"),
        cells=pd.read_parquet(INTERIM / "cells_monthly.parquet"),
        factors=pd.read_parquet(INTERIM / "factors.parquet"),
        resolutions={scope: settings["res"] for scope, settings in SCOPES.items()},
        months=all_months(period["first"], period["last"]),
    )


@app.command()
def load() -> None:
    """Parquet de interim -> Postgres (necesita DATABASE_URL)."""
    from kindra.db_load import load_all

    load_all()


def region_series() -> pd.DataFrame:
    """Serie mensual de la zona California entera, para la prueba del salto de 2012."""
    series = pd.read_parquet(INTERIM / "monthly_series.parquet")
    return series[series["zone_id"] == REGION_ZONE_ID]


def features() -> pd.DataFrame:
    """Tabla de variables del pronóstico: celdas-día de referencia más el clima de NASA POWER."""
    from kindra.ml import power
    from kindra.ml.features import build_features
    from kindra.ml.train import FIRST_TRAIN_YEAR

    days = pd.read_parquet(INTERIM / f"cell_days_{REGION_SCOPE}.parquet")
    # Solo la época VIIRS: el modelo no usa años anteriores y así se piden menos años a POWER.
    reference = days[days["is_reference"] & (days["day"].dt.year >= FIRST_TRAIN_YEAR)]
    years = sorted(reference["day"].dt.year.unique())
    weather = power.weather_for_cells(reference[["clat", "clon"]], years)
    return build_features(reference, weather)


if __name__ == "__main__":
    app()
