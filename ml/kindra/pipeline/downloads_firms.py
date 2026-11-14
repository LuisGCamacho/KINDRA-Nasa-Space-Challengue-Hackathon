import os, requests
from tqdm import tqdm
from .config import RAW
BASE = "https://firms.modaps.eosdis.nasa.gov"
SENSORS = {"modis": "modis", "viirs-snpp": "viirs-snpp", "viirs-noaa20": "viirs-jpss1"}

def yearly(country="Argentina", years=range(2000, 2026)):
    for name, folder in SENSORS.items():
        for y in tqdm(years, desc=name):
            # Verificar el nombre exacto en la página "Archive Download" de FIRMS
            url = f"{BASE}/data/country/{folder}/{y}/{folder}_{y}_{country}.csv"
            out = RAW/name/f"{y}_{country}.csv"; out.parent.mkdir(parents=True, exist_ok=True)
            r = requests.get(url, timeout=120)
            if r.ok: out.write_bytes(r.content)

def nrt(source="VIIRS_NOAA20_NRT", bbox="-74,-56,-53,-21", days=5, date=None):
    """La API acepta hasta 5 días por pedido. bbox = oeste,sur,este,norte."""
    key = os.environ["FIRMS_MAP_KEY"]
    url = f"{BASE}/api/area/csv/{key}/{source}/{bbox}/{days}" + (f"/{date}" if date else "")
    return requests.get(url, timeout=120).text
