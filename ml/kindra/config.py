"""Rutas, años, grillas y fechas del método. Todo el pipeline lee sus constantes de aquí.

Si cambia algo del método (años de calibración, grilla, satélite de referencia), se cambia en
este archivo y en ningún otro.
"""

from __future__ import annotations

from pathlib import Path

ML = Path(__file__).resolve().parents[1]  # las claves de ml/.env se cargan en kindra/__init__.py
RAW = ML / "data" / "raw"  # CSV de FIRMS (no se sube a Git)
NRT_FOLDER = "nrt"  # subcarpeta de RAW con los últimos días de la API NRT (provisionales)
INTERIM = ML / "data" / "interim"  # Parquet intermedios (no se sube a Git)
BOUNDARIES = ML / "data" / "boundaries"  # GeoJSON de zonas
MODELS = ML / "models"  # modelo de próximas 24 h y pesos de YOLO (no se sube a Git)
WEB_DATA = ML.parent / "web" / "data"  # JSON de respaldo que lee la app

FIRST_DAY = "2000-11-01"  # primer mes completo de MODIS Terra
CALIBRATION_YEARS = range(2012, 2022)  # 2012–2021: antes de la deriva de órbita de Terra y Aqua
HOLDOUT_YEARS = range(2022, 2026)  # 2022–2025: años de prueba del factor
# NOAA-20 voló junto a Aqua desde 2018: su factor propio se calibra con esos años (tutorial, 5.7).
NOAA20_CALIBRATION_YEARS = range(2018, 2022)

# Región de trabajo. FIRMS publica archivos anuales por país, no por estado: se baja el de
# Estados Unidos y se recorta a este recuadro al guardarlo. El recuadro también toma una franja
# de Nevada y de Oregón; los límites reales los ponen las zonas (condados) al agregar.
FIRMS_COUNTRY = "United_States"
REGION_NAME = "California"
REGION_BBOX = (-124.5, 32.5, -114.1, 42.1)  # grados: oeste, sur, este, norte

# Confianza mínima de MODIS (0–100). Verificar con el cuaderno 02_calibracion antes de la corrida final.
MODIS_MIN_CONFIDENCE = 30

# Dos grillas: la región (California) fina y el resto del mundo gruesa, para que los JSON del mundo
# no pasen de ~5 MB. `res` en grados (0,1° ≈ 11 km); `bbox` = oeste, sur, este, norte, en grados.
SCOPES = {
    "ca": {"res": 0.1, "bbox": REGION_BBOX},
    "world": {"res": 0.5, "bbox": (-180, -90, 180, 90)},
}

# Un satélite de la tarde por fecha (AGENTS.md, método 2): cada uno vale desde el día indicado.
REFERENCE_SATELLITES = [
    ("Terra", "2000-11-01"),
    ("Aqua", "2002-07-05"),
    ("SNPP", "2012-01-21"),
    ("NOAA20", "2026-11-03"),  # Suomi NPP dejó de operar el 2026-11-02
]
MODIS_SATELLITES = ("Terra", "Aqua")
VIIRS_SATELLITES = ("SNPP", "NOAA20")
VIIRS_START = "2012-01"  # antes de este mes la columna `viirs` de la serie es null

# Código de `src` en la serie mensual, por satélite de referencia.
SOURCE_CODE = {"Terra": "MODIS_TERRA", "Aqua": "MODIS_AQUA", "SNPP": "VIIRS_SNPP", "NOAA20": "VIIRS_NOAA20"}
