"""Un satélite de la tarde por fecha (AGENTS.md, método 2).

La serie usa un solo satélite por día para no sumar dos veces el mismo incendio. Las fechas de
cambio están en `config.REFERENCE_SATELLITES`.
"""

from __future__ import annotations

import pandas as pd

from kindra.config import REFERENCE_SATELLITES


def reference_satellite(day: pd.Series) -> pd.Series:
    """Devuelve el satélite de referencia de cada fecha: `Terra`, `Aqua`, `SNPP` o `NOAA20`.

    Las fechas anteriores al primer satélite quedan en `None`.
    """
    names = [name for name, _ in REFERENCE_SATELLITES]
    starts = pd.to_datetime([start for _, start in REFERENCE_SATELLITES])
    # `searchsorted` da la posición del último satélite que ya había empezado en esa fecha.
    position = starts.searchsorted(pd.to_datetime(day), side="right") - 1
    return pd.Series([names[p] if p >= 0 else None for p in position], index=day.index)


def mark_reference(cell_days: pd.DataFrame) -> pd.DataFrame:
    """Agrega `is_reference`: `True` si la fila es del satélite de referencia de su fecha."""
    return cell_days.assign(is_reference=cell_days["sat"] == reference_satellite(cell_days["day"]))
