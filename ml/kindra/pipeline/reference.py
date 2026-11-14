import pandas as pd
from .config import SNPP_END

def afternoon_reference(cd: pd.DataFrame) -> pd.DataFrame:
    """Serie de la tarde con un solo satélite por fecha."""
    d = cd["acq_date"]
    terra = (cd.satellite == "Terra") & (d < "2002-07-04")
    aqua = (cd.satellite == "Aqua") & (d >= "2002-07-04") & (d < "2012-01-20")
    snpp = (cd.sensor == "viirs-snpp") & (d >= "2012-01-20") & (d < SNPP_END)
    noaa20 = (cd.sensor == "viirs-noaa20") & (d >= SNPP_END)
    return cd[terra | aqua | snpp | noaa20]
