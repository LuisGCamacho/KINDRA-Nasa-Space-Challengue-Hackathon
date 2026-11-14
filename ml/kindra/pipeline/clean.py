import pandas as pd
from .config import MODIS_MIN_CONF, VIIRS_CONF

def clean(df: pd.DataFrame, sensor: str) -> pd.DataFrame:
    if "type" in df: df = df[df["type"] == 0]                      # solo vegetación
    if sensor == "modis": df = df[df["confidence"].astype(int) >= MODIS_MIN_CONF]
    else: df = df[df["confidence"].isin(VIIRS_CONF)]
    df["acq_date"] = pd.to_datetime(df["acq_date"])
    hh = df["acq_time"].astype(int) // 100 + (df["acq_time"].astype(int) % 100) / 60
    df["solar_hour"] = (hh + df["longitude"] / 15) % 24            # hora solar local
    df["sensor"] = sensor
    return df.drop_duplicates(["latitude", "longitude", "acq_date", "acq_time", "satellite"])
