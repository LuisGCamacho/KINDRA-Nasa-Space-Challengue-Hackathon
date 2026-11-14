import numpy as np, pandas as pd

def to_cell_days(df: pd.DataFrame, res: float) -> pd.DataFrame:
    """Una fila por celda, día y satélite: elimina el efecto del tamaño de píxel."""
    lat = np.floor(df["latitude"] / res) * res + res / 2
    lon = np.floor(df["longitude"] / res) * res + res / 2
    g = df.assign(clat=lat.round(3), clon=lon.round(3))
    return (g.groupby(["clat", "clon", "acq_date", "satellite", "sensor"])
             .agg(points=("latitude", "size"), frp_max=("frp", "max")).reset_index())
