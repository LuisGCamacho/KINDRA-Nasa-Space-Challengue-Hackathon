"""Pruebas del ensayo: la pasada que despierta al agente y la hora de cada imagen del video."""

from datetime import timedelta

import pandas as pd

from kindra.agent import rehearsal

CAMERA = (-118.54878, 34.08642)  # Green Peak (lon, lat)


def hotspot(lat: float, lon: float, time: int, kind: int = 0, source: str = "VIIRS_NOAA20") -> dict:
    return {"latitude": lat, "longitude": lon, "acq_date": "2025-01-07", "acq_time": time,
            "type": kind, "frp": 10.0, "confidence": "n", "source": source}


def test_first_pass_skips_before_ignition_and_far_hotspots():
    df = pd.DataFrame([
        hotspot(34.0674, -118.55, 1000),  # antes de la ignición (18:25)
        hotspot(36.0, -118.55, 1900),  # pasada anterior, pero a más de 200 km
        hotspot(34.0674, -118.55, 1946),  # 2,1 km: la que vale
        hotspot(34.05, -118.53, 1946),  # misma pasada, más lejos
        hotspot(34.0674, -118.55, 2104, source="VIIRS_SNPP"),  # pasada siguiente
    ])
    sat = rehearsal.first_pass(df, CAMERA, rehearsal.IGNITION)
    assert f"{sat.when:%H%M}" == "1946"
    assert len(sat.hotspots) == 2 and sat.hotspots.iloc[0]["latitude"] == 34.0674
    assert sat.match.found and sat.match.nearest_km == 2.1 and sat.match.hours_ago == 0


def test_first_pass_none_without_nearby_hotspot():
    assert rehearsal.first_pass(pd.DataFrame([hotspot(36.0, -118.55, 1946)]), CAMERA, rehearsal.IGNITION) is None


def test_frame_time_centers_on_ignition():
    assert rehearsal.frame_time(rehearsal.IGNITION_FRAME) == rehearsal.IGNITION
    assert rehearsal.frame_time(0) == rehearsal.IGNITION - timedelta(minutes=40)
    assert rehearsal.minutes_after_ignition(rehearsal.frame_time(50)) == 10


def test_archive_hotspots_filters_day_and_static_sources(tmp_path):
    folder = tmp_path / "viirs-jpss1"
    folder.mkdir()
    rows = [hotspot(34.0, -118.5, 1946), hotspot(33.8, -118.2, 1946, kind=2),
            {**hotspot(34.0, -118.5, 1946), "acq_date": "2025-01-08"}]
    pd.DataFrame(rows).drop(columns="source").to_csv(folder / "viirs-jpss1_2025_California.csv", index=False)
    df = rehearsal.archive_hotspots("2025-01-07", raw=tmp_path)
    assert len(df) == 1 and df.iloc[0]["source"] == "VIIRS_NOAA20"
