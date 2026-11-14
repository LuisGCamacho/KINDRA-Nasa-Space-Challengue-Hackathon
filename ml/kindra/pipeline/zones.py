import geopandas as gpd
def assign_zones(cells, zones_gdf: gpd.GeoDataFrame):
    pts = gpd.GeoDataFrame(cells, geometry=gpd.points_from_xy(cells.clon, cells.clat), crs=4326)
    return gpd.sjoin(pts, zones_gdf[["zone_id", "geometry"]], predicate="within").drop(columns="index_right")
# aggregate.py — serie mensual cruda y armonizada por zona
def monthly_series(z_cells, factors):
    m = z_cells.assign(t=z_cells.acq_date.dt.to_period("M"), month=z_cells.acq_date.dt.month)
    raw = m.groupby(["zone_id", "t"]).size().rename("raw")
    ref = m[m.is_reference]
    ref = ref.merge(factors, on=["region", "month"], how="left")
    viirs = ref.sensor.str.startswith("viirs")
    ref["w"] = ref.k.where(viirs, 1.0)                 # VIIRS se lleva a escala MODIS
    ref["w_lo"] = ref.k_low.where(viirs, 1.0)
    ref["w_hi"] = ref.k_high.where(viirs, 1.0)
    harm = ref.groupby(["zone_id", "t"]).agg(harm=("w", "sum"), lo=("w_lo", "sum"), hi=("w_hi", "sum"))
    return raw.to_frame().join(harm, how="outer").fillna(0).reset_index()
