"""Zonas: polígonos de `ml/data/boundaries/` y qué celdas caen en cada una.

Las zonas de California salen de `california.geojson`: el estado (`provincia`, `us-ca`) y sus
58 condados (`departamento`, `us-ca-<condado>`), con los límites del Censo de Estados Unidos.
"""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import pandas as pd

ZONE_COLUMNS = ["id", "name", "type", "parent", "country"]
EQUAL_AREA = "EPSG:6933"  # proyección de áreas iguales, para medir km²
DECIMALS = 4  # grados (~11 m): alcanza para el centro y el recuadro del mapa


def load_zones(boundaries: Path) -> gpd.GeoDataFrame:
    """Une todos los GeoJSON de `boundaries`. Cada polígono trae `id`, `name`, `type`, `parent` y `country`.

    Raises:
        FileNotFoundError: Si no hay ningún GeoJSON.
        ValueError: Si falta alguna propiedad o hay ids repetidos.
    """
    files = sorted(boundaries.glob("*.geojson"))
    if not files:
        raise FileNotFoundError(f"No hay GeoJSON de zonas en {boundaries}")

    zones = pd.concat([gpd.read_file(f).to_crs(4326) for f in files], ignore_index=True)
    missing = [c for c in ZONE_COLUMNS if c not in zones.columns]
    if missing:
        raise ValueError(f"A los GeoJSON les faltan las propiedades {missing}")
    if zones["id"].duplicated().any():
        raise ValueError(f"Ids de zona repetidos: {zones.loc[zones['id'].duplicated(), 'id'].tolist()}")
    return gpd.GeoDataFrame(zones[ZONE_COLUMNS + ["geometry"]], geometry="geometry", crs=4326)


def zone_table(zones: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Agrega a cada zona su centro, su recuadro y su área: las columnas de la tabla `zones`.

    Returns:
        Las columnas de `ZONE_COLUMNS` más `center` (`[lon, lat]`), `bbox` (`[oeste, sur, este,
        norte]`), ambos en grados, `area_km2` y `geometry`. `parent` queda en `None` si no hay.
    """
    table = zones.copy()
    table["parent"] = table["parent"].where(table["parent"].map(lambda p: isinstance(p, str)), None)
    table["center"] = table.geometry.map(center_of)
    table["bbox"] = table.geometry.map(bbox_of)
    table["area_km2"] = (table.to_crs(EQUAL_AREA).area / 1e6).round(1)
    return table[ZONE_COLUMNS + ["center", "bbox", "area_km2", "geometry"]]


def save_zones(zones: gpd.GeoDataFrame, path: Path) -> None:
    """Guarda la tabla de zonas en Parquet para `db_load.py` (Base de datos)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    zone_table(zones).to_parquet(path, index=False)


def zone_records(zones: gpd.GeoDataFrame) -> list[dict]:
    """Filas de `web/data/zones.json` con el contrato `Zone`."""
    return [
        {
            "id": row.id, "name": row.name, "type": row.type, "parent": row.parent,
            "country": row.country, "center": row.center, "bbox": row.bbox,
            "areaKm2": round(float(row.area_km2)),
        }
        for row in zone_table(zones).itertuples()
    ]


def cell_zones(cells: pd.DataFrame, zones: gpd.GeoDataFrame) -> pd.DataFrame:
    """Cruza el centro de cada celda con los polígonos.

    Una celda puede estar en varias zonas a la vez: en California y en su condado.

    Args:
        cells: Una fila por celda con `scope`, `i`, `j`, `clat` y `clon`.
        zones: Salida de `load_zones`.

    Returns:
        Una fila por celda y zona con `scope`, `i`, `j` y `zone_id`.
    """
    points = gpd.GeoDataFrame(cells, geometry=gpd.points_from_xy(cells["clon"], cells["clat"]), crs=4326)
    joined = gpd.sjoin(points, zones[["id", "geometry"]], predicate="within")
    return pd.DataFrame(joined[["scope", "i", "j", "id"]]).rename(columns={"id": "zone_id"})


def center_of(geometry) -> list[float]:
    """Punto representativo `[lon, lat]`: siempre cae dentro de la zona, aunque tenga forma de C."""
    point = geometry.representative_point()
    return [round(point.x, DECIMALS), round(point.y, DECIMALS)]


def bbox_of(geometry) -> list[float]:
    """Recuadro `[oeste, sur, este, norte]` de la zona."""
    return [round(v, DECIMALS) for v in geometry.bounds]
