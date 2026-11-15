"""KINDRA: serie armonizada de focos de calor MODIS + VIIRS (NASA FIRMS, 2000–2026)."""

from pathlib import Path

from dotenv import load_dotenv

# Claves (FIRMS_MAP_KEY, LLM_*) desde ml/.env, que no se sube a Git. Se cargan aquí para que
# cualquier módulo de `kindra` las vea. Una variable ya definida en la terminal tiene prioridad.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
