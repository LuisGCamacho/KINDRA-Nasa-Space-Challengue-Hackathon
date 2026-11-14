import numpy as np, pandas as pd
from .config import CALIB_YEARS

def monthly_factors(cd: pd.DataFrame, n_boot: int = 300) -> pd.DataFrame:
    """k = celdas-día Aqua / celdas-día VIIRS, por región y mes del año, en 2012–2021.
    Lleva VIIRS a la escala MODIS (en Argentina, k ≈ 0,2)."""
    cd = cd[cd.acq_date.dt.year.isin(CALIB_YEARS)].assign(month=lambda x: x.acq_date.dt.month)
    aqua = cd[cd.satellite == "Aqua"].groupby(["region", "month", cd.acq_date.dt.year]).size()
    viirs = cd[cd.sensor == "viirs-snpp"].groupby(["region", "month", cd.acq_date.dt.year]).size()
    both = pd.concat({"a": aqua, "v": viirs}, axis=1).fillna(0).reset_index()
    rows, rng = [], np.random.default_rng(42)
    for (reg, m), g in both.groupby(["region", "month"]):
        k = g.a.sum() / max(g.v.sum(), 1)
        boot = [g.sample(len(g), replace=True, random_state=rng.integers(1e9)) for _ in range(n_boot)]
        ks = [b.a.sum() / max(b.v.sum(), 1) for b in boot]
        rows.append({"region": reg, "month": m, "k": k, "k_low": np.percentile(ks, 5),
                     "k_high": np.percentile(ks, 95), "n_years": len(g)})
    f = pd.DataFrame(rows)
    # contracción: mezcla con el factor nacional del mismo mes si hay pocos años
    nat = f.groupby("month").k.median().rename("k_nat")
    f = f.join(nat, on="month"); w = (f.n_years / 10).clip(0, 1)
    f["k"] = w * f.k + (1 - w) * f.k_nat
    return f
