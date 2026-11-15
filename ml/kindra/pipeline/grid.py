"""Celdas-día: una celda con fuego en un día cuenta una vez por satélite (AGENTS.md, método 1).

Contar celdas-día en vez de focos quita buena parte del efecto del tamaño de píxel: VIIRS
(375 m) marca muchos más píxeles que MODIS (1 km) sobre el mismo incendio.
"""

from __future__ import annotations

import pandas as pd

from kindra.ml.calibration import cell_index

CENTER_DECIMALS = 4  # grados; el centro se usa como clave para cruzar con zonas y con POWER
CELL_DAY_COLUMNS = ["sat", "i", "j", "clat", "clon", "day", "frp_max", "nrt"]


def to_cell_days(fires: pd.DataFrame, res: float) -> pd.DataFrame:
    """Agrupa los focos limpios en celdas-día.

    Args:
        fires: Salida de `clean.clean`, ya recortada con `clean.inside`.
        res: Tamaño de la celda, en grados (0,1 en California; 0,5 en el mundo).

    Returns:
        Una fila por satélite, celda y día con `sat`, `i` y `j` (índices de la celda), `clat` y
        `clon` (centro, en grados), `day`, `frp_max` (el FRP más alto de los focos de esa celda y
        día, en MW) y `nrt` (`True` si algún foco vino de un archivo NRT).
    """
    cells = fires.assign(i=cell_index(fires["lat"], res), j=cell_index(fires["lon"], res))
    days = (cells.groupby(["sat", "i", "j", "day"], as_index=False)
                 .agg(frp_max=("frp", "max"), nrt=("nrt", "any")))
    days = days.assign(clat=cell_center(days["i"], res), clon=cell_center(days["j"], res))
    return days[CELL_DAY_COLUMNS]


def cell_center(index: pd.Series, res: float) -> pd.Series:
    """Centro de la celda en grados, redondeado para que sirva como clave."""
    return ((index + 0.5) * res).round(CENTER_DECIMALS)
