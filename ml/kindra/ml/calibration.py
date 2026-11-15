"""Calibración del factor VIIRS → MODIS a partir de los CSV de NASA FIRMS.

El cuaderno `ml/notebooks/02_calibracion.ipynb` usa estas funciones para decidir la grilla y el
tipo de factor; `validation.py` las reutiliza para el holdout 2022–2025. El cálculo definitivo de
los factores vive en `kindra/pipeline/harmonize.py` (Datos).

Idea central: Aqua (MODIS) y un satélite VIIRS miraron Argentina a la misma hora de la tarde
durante varios años. En esos años, `k = celdas-día Aqua / celdas-día VIIRS` dice cuánto vale un
foco VIIRS en la escala MODIS.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Iterator
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

AR_BBOX = (-74, -56, -53, -21)  # grados: oeste, sur, este, norte
VIIRS_OK_CONFIDENCE = ("n", "h")  # nominal y alta; la baja ("l") se descarta

# FIRMS escribe el mismo satélite de varias formas según el archivo y la fecha de descarga.
SATELLITES = {
    "Aqua": "Aqua", "A": "Aqua",
    "Terra": "Terra", "T": "Terra",
    "N": "SNPP", "NPP": "SNPP", "Suomi NPP": "SNPP",
    "N20": "NOAA20", "1": "NOAA20",
    "N21": "NOAA21",
}

FACTOR_KINDS = ("único", "estacional", "mensual")
SEASON = {12: "DEF", 1: "DEF", 2: "DEF", 3: "MAM", 4: "MAM", 5: "MAM",
          6: "JJA", 7: "JJA", 8: "JJA", 9: "SON", 10: "SON", 11: "SON"}
_MONTHS = pd.Series(range(1, 13), index=range(1, 13))

Split = tuple[pd.DataFrame, pd.DataFrame]  # (calibración, prueba)


# ---------------------------------------------------------------------------------------------
# Carga y limpieza
# ---------------------------------------------------------------------------------------------

def load_firms(raw: Path, first_day: str, last_day: str) -> pd.DataFrame:
    """Lee todos los CSV de FIRMS de `raw` y sus subcarpetas en una sola tabla.

    DuckDB une los archivos por nombre de columna, porque MODIS (`brightness`) y VIIRS
    (`bright_ti4`) no tienen las mismas. Todo se lee como texto y se convierte después, porque
    `confidence` es un número en MODIS y una letra en VIIRS.

    Args:
        raw: Carpeta con los CSV (`ml/data/raw/`).
        first_day: Primer día a leer, `YYYY-MM-DD`.
        last_day: Último día a leer, `YYYY-MM-DD`.

    Returns:
        Una fila por foco con `lat`, `lon`, `day`, `utc_hhmm`, `satellite`, `instrument`,
        `confidence`, `daynight` y `type` (`None` si el archivo no trae esa columna).

    Raises:
        FileNotFoundError: Si `raw` no tiene ningún CSV.
    """
    if not any(raw.rglob("*.csv")):
        raise FileNotFoundError(f"No hay CSV de FIRMS en {raw}")

    source = f"read_csv('{(raw / '**' / '*.csv').as_posix()}', union_by_name = true, all_varchar = true)"
    columns = set(duckdb.sql(f"describe select * from {source}").df()["column_name"])
    # Los CSV de la API NRT no traen `type`; en ese caso no se puede filtrar por tipo.
    type_column = "type" if "type" in columns else "null"

    fires = duckdb.sql(f"""
        select cast(latitude as double)  as lat,
               cast(longitude as double) as lon,
               cast(acq_date as date)    as day,
               acq_time                  as utc_hhmm,
               trim(satellite)           as satellite,
               upper(trim(instrument))   as instrument,
               lower(trim(confidence))   as confidence,
               upper(trim(daynight))     as daynight,
               {type_column}             as type
        from {source}
        where cast(acq_date as date) between '{first_day}' and '{last_day}'
    """).df()
    fires["day"] = pd.to_datetime(fires["day"])
    return fires


def unknown_satellites(fires: pd.DataFrame) -> list[str]:
    """Devuelve los códigos de satélite que `SATELLITES` todavía no reconoce."""
    codes = fires["satellite"].dropna().unique()
    return sorted(code for code in codes if code not in SATELLITES)


def clean_fires(fires: pd.DataFrame, modis_min_confidence: int,
                bbox: tuple[float, float, float, float] = AR_BBOX) -> pd.DataFrame:
    """Deja los focos que cuentan para el método.

    Se quedan los focos de vegetación (`type = 0`, si la columna existe), con confianza suficiente
    y dentro del recuadro. Además calcula la hora solar local del paso del satélite.

    Args:
        fires: Salida de `load_firms`.
        modis_min_confidence: Confianza mínima de MODIS (0–100).
        bbox: Recuadro en grados: oeste, sur, este, norte.

    Returns:
        Columnas `lat`, `lon`, `day`, `sat` (`Aqua`, `Terra`, `SNPP`, `NOAA20`…), `daynight`
        y `solar_hour` (horas, 0–24).
    """
    is_modis = fires["instrument"].str.startswith("MODIS", na=False)
    modis_ok = pd.to_numeric(fires["confidence"], errors="coerce") >= modis_min_confidence
    # VIIRS escribe la confianza como "n"/"h"/"l" o "nominal"/"high"/"low" según el archivo.
    viirs_ok = fires["confidence"].str[0].isin(VIIRS_OK_CONFIDENCE)
    confident = (is_modis & modis_ok) | (~is_modis & viirs_ok)

    vegetation = fires["type"].isna() | (fires["type"].astype(str) == "0")
    west, south, east, north = bbox
    inside = fires["lon"].between(west, east) & fires["lat"].between(south, north)

    clean = fires.loc[confident & vegetation & inside].copy()
    clean["sat"] = clean["satellite"].map(SATELLITES)
    clean["solar_hour"] = solar_hour(clean["utc_hhmm"], clean["lon"])
    clean = clean.dropna(subset=["sat"])
    return clean[["lat", "lon", "day", "sat", "daynight", "solar_hour"]].reset_index(drop=True)


def solar_hour(utc_hhmm: pd.Series, lon: pd.Series) -> pd.Series:
    """Convierte la hora UTC de FIRMS (`HHMM`) en hora solar local.

    La Tierra gira 15° por hora, así que la hora solar adelanta `lon / 15` horas respecto de UTC.
    """
    hhmm = pd.to_numeric(utc_hhmm, errors="coerce")
    utc_hours = hhmm // 100 + (hhmm % 100) / 60
    return (utc_hours + lon / 15) % 24


def yearly_coverage(clean: pd.DataFrame, years: Iterable[int], satellites: list[str]) -> pd.DataFrame:
    """Cuenta los focos por año y satélite; un 0 indica que falta el archivo de ese año."""
    return (pd.crosstab(clean["day"].dt.year.rename("año"), clean["sat"])
              .reindex(index=list(years), columns=satellites, fill_value=0))


def overpass_hour(clean: pd.DataFrame) -> pd.DataFrame:
    """Devuelve la mediana de la hora solar de los pasos diurnos, por año y satélite.

    Si la hora de Aqua o de Terra se corre con los años, el satélite derivó de órbita y deja de
    ver lo mismo que VIIRS. Por eso se calibra solo en los años en que la hora se mantiene.
    """
    daytime = clean[clean["daynight"] == "D"]
    return (daytime.groupby([daytime["day"].dt.year.rename("año"), "sat"])["solar_hour"]
                   .median().unstack("sat"))


# ---------------------------------------------------------------------------------------------
# Celdas-día y factores
# ---------------------------------------------------------------------------------------------

def cell_index(degrees: pd.Series, res: float) -> pd.Series:
    """Devuelve el índice entero de la celda de `res` grados que contiene cada coordenada.

    Se redondea antes de `floor` porque, por ejemplo, `0.3 / 0.1` da `2.9999999999999996`
    y el punto caería en la celda vecina. `harmonize.py` debe usar la misma regla.
    """
    return np.floor((degrees / res).round(6)).astype(int)


def monthly_cell_days(clean: pd.DataFrame, res: float, modis: str = "Aqua",
                      viirs: str = "SNPP") -> pd.DataFrame:
    """Cuenta las celdas-día de un satélite MODIS (`a`) y de uno VIIRS (`v`) por año y mes.

    Una celda con fuego en un día cuenta una sola vez por satélite, caigan uno o veinte píxeles.
    Así se quita buena parte del efecto del tamaño de píxel (1 km en MODIS, 375 m en VIIRS).

    Args:
        clean: Salida de `clean_fires`.
        res: Tamaño de la celda, en grados.
        modis: Satélite MODIS de referencia (por defecto Aqua, que pasa a la tarde como VIIRS).
        viirs: Satélite VIIRS a llevar a la escala MODIS.

    Returns:
        Una fila por año y mes con `year`, `month`, `a` y `v`.
    """
    pair = clean[clean["sat"].isin([modis, viirs])]
    cells = pair.assign(i=cell_index(pair["lat"], res), j=cell_index(pair["lon"], res))
    cell_days = cells.drop_duplicates(["sat", "i", "j", "day"])
    return (pd.crosstab([cell_days["day"].dt.year.rename("year"),
                         cell_days["day"].dt.month.rename("month")], cell_days["sat"])
              .reindex(columns=[modis, viirs], fill_value=0)
              .set_axis(["a", "v"], axis=1)
              .reset_index())


def ratio(a, v):
    """Devuelve `a / v` evitando dividir por cero cuando VIIRS no vio fuego."""
    return a / np.maximum(v, 1)


def monthly_factors(counts: pd.DataFrame, years: Iterable[int], n_boot: int = 300,
                    seed: int = 42) -> pd.DataFrame:
    """Calcula `k` por mes del año con un intervalo del 90 % por bootstrap.

    El remuestreo toma años completos (dentro de un mes, cada fila es un año): así el intervalo
    refleja cuánto cambia `k` de un año a otro, que es la incertidumbre que importa.

    Args:
        counts: Salida de `monthly_cell_days`.
        years: Años de calibración.
        n_boot: Cantidad de remuestreos.
        seed: Semilla, para que el intervalo salga igual en cada corrida.

    Returns:
        Una fila por mes con `month`, `k`, `k_low`, `k_high`, `n_years`, `aqua` y `viirs`.
    """
    rng = np.random.default_rng(seed)
    rows = []
    for month, g in counts[counts["year"].isin(list(years))].groupby("month"):
        a, v = g["a"].to_numpy(), g["v"].to_numpy()
        samples = rng.integers(0, len(g), size=(n_boot, len(g)))
        boot_k = ratio(a[samples].sum(axis=1), v[samples].sum(axis=1))
        rows.append({
            "month": month,
            "k": ratio(a.sum(), v.sum()),
            "k_low": np.percentile(boot_k, 5),
            "k_high": np.percentile(boot_k, 95),
            "n_years": len(g),
            "aqua": int(a.sum()),
            "viirs": int(v.sum()),
        })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------------------------
# Comparación de tipos de factor
# ---------------------------------------------------------------------------------------------

def factor_key(month: pd.Series, kind: str) -> pd.Series:
    """Devuelve a qué factor pertenece cada mes: uno solo, su estación o el propio mes."""
    if kind == "único":
        return month * 0
    if kind == "estacional":
        return month.map(SEASON)
    if kind == "mensual":
        return month
    raise ValueError(f"Tipo de factor desconocido: {kind}")


def fit_k(train: pd.DataFrame, kind: str) -> pd.Series:
    """Calibra `k` con `train` y lo devuelve por mes del año (índice 1–12)."""
    sums = train.groupby(factor_key(train["month"], kind))[["a", "v"]].sum()
    k = ratio(sums["a"], sums["v"])
    return factor_key(_MONTHS, kind).map(k)


def leave_one_year_out(counts: pd.DataFrame, years: Iterable[int]) -> Iterator[Split]:
    """Parte en (calibración, prueba) dejando afuera un año por vez."""
    years = list(years)
    for year in years:
        train = counts[counts["year"].isin(years) & (counts["year"] != year)]
        yield train, counts[counts["year"] == year]


def train_test(counts: pd.DataFrame, train_years: Iterable[int],
               test_years: Iterable[int]) -> Iterator[Split]:
    """Una sola partición: calibra en `train_years` y prueba en `test_years`."""
    yield counts[counts["year"].isin(list(train_years))], counts[counts["year"].isin(list(test_years))]


def evaluate(splits: Iterable[Split], kind: str) -> dict[str, float]:
    """Predice Aqua como `VIIRS × k` en cada partición y mide el error.

    Returns:
        `MAE mensual (celdas-día)`, `error anual (%)` (promedio del error del total de cada año)
        y `r` (correlación entre lo predicho y Aqua real, mes a mes).
    """
    predicted = pd.concat([
        test.assign(pred=test["v"] * test["month"].map(fit_k(train, kind)))
        for train, test in splits
    ])
    yearly = predicted.groupby("year")[["a", "pred"]].sum()
    return {
        "MAE mensual (celdas-día)": (predicted["pred"] - predicted["a"]).abs().mean(),
        "error anual (%)": (ratio((yearly["pred"] - yearly["a"]).abs(), yearly["a"])).mean() * 100,
        "r": predicted["pred"].corr(predicted["a"]),
    }


def compare_factors(counts_by_res: dict[float, pd.DataFrame],
                    make_splits: Callable[[pd.DataFrame], Iterable[Split]]) -> pd.DataFrame:
    """Evalúa cada grilla y tipo de factor con las particiones que arma `make_splits(counts)`.

    Returns:
        Una fila por (grilla, factor) con las métricas de `evaluate`.
    """
    table = pd.DataFrame({
        (res, kind): evaluate(make_splits(counts), kind)
        for res, counts in counts_by_res.items()
        for kind in FACTOR_KINDS
    }).T
    return table.rename_axis(["grilla", "factor"])
