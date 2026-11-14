from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
RAW, INTERIM, BOUND = ROOT/"data/raw", ROOT/"data/interim", ROOT/"data/boundaries"
WEB_DATA = ROOT.parent/"web/data"
YEARS = range(2000, 2027)
CALIB_YEARS = range(2012, 2022)          # antes de la deriva orbital de Terra y Aqua
RES_AR, RES_WORLD = 0.1, 0.5             # grillas en grados
MODIS_MIN_CONF = 30                      # MODIS: confianza 0–100
VIIRS_CONF = {"n", "h"}                  # VIIRS: nominal y alta
SNPP_END = "2026-11-02"                  # fin de Suomi NPP en FIRMS
LEVELS = [(3, "Muy alto"), (1.5, "Alto"), (0.67, "Normal"), (0, "Bajo")]
