"""Carpetas que comparten Python y la app durante la demo. Ninguna se sube a Git."""

from __future__ import annotations

import json
import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "web"

CAMERAS_JSON = WEB / "data" / "cameras.json"
LIVE = WEB / "data" / "live"  # detecciones, recorridos y colas que lee la API
FRAMES = WEB / "public" / "live" / "frames"  # imágenes que muestra la app y adjunta el correo
FRAMES_URL = "/live/frames"
FALSE_POSITIVE_LOGS = REPO / "ml" / "data" / "false_positives"


def write_json(path: Path, value) -> None:
    """Escribe en un temporal y renombra: la app nunca lee un JSON a medias."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def read_json(path: Path, default):
    """Devuelve el JSON de `path`, o `default` si el archivo todavía no existe."""
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))
