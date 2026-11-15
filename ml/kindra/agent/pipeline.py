"""Recorrido del agente: primero el satélite, después la cámara.

Cada ciclo (el comando `watch` lo repite cada ~30 min):

1. **FIRMS:** baja los focos de calor de las últimas 24 h alrededor de las cámaras y se queda con
   los que todavía no vio.
2. **Cámara:** busca las cámaras a menos de `CAMERA_RADIUS_KM` de cada foco nuevo. Un foco sin
   cámara cerca solo se anota (no hay imagen que mirar).
3. **Visión:** baja las últimas imágenes de la cámara, corre el detector y sigue el humo entre
   imágenes (`vision.track`). Si el detector no ve nada, se buscan cambios de color (`anomaly`).
4. **Gemini y reglas** (`supervisor`): confirma, descarta o deja para revisar.
5. **Informe** (`report.deliver`): la app guarda la alerta y, si se confirmó, manda el correo.

De noche el detector no ve humo (`detect.py`), así que no se le pregunta a Gemini: la alerta
queda en `revisar` con el foco satelital como única prueba, y sin correo.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import requests

from kindra.agent import firms_nrt, report, supervisor, water
from kindra.agent.rules import MIN_PERSISTENT_FRAMES, Evidence, is_large_fire
from kindra.contracts import AgentReview, AlertEmailDraft, Detection, FireRegion, FirmsMatch, NearbyMaterial, WaterSource
from kindra.geo import bbox_around, distance_m
from kindra.live_paths import FRAMES, FRAMES_URL, LIVE, read_json, write_json
from kindra.vision import annotate, anomaly, cameras, detect, materials, track

CAMERA_RADIUS_KM = firms_nrt.RADIUS_KM  # el mismo radio con que se busca FIRMS alrededor de una detección
FRAMES_PER_CHECK = 4  # imágenes por cámara: la actual y 3 anteriores, lo mínimo para MIN_PERSISTENT_FRAMES
COOLDOWN_H = 6  # horas sin volver a alertar por la misma cámara: el mismo incendio no manda un correo por ciclo
WATCHED_PROVIDERS = frozenset({"caltrans"})  # cámaras reales con imágenes por URL; la de demo es un video local
SEEN_KEEP_H = 48  # horas que se recuerda un foco ya visto; FIRMS no devuelve focos más viejos (DAYS = 2)

AGENT_STATE = LIVE / "agent"
SEEN = AGENT_STATE / "focos-vistos.json"  # {clave del foco: hora en que se vio}
LAST_ALERT = AGENT_STATE / "ultima-alerta.json"  # {id de cámara: hora de la última alerta}
DETECTIONS = LIVE / "detections"  # {cameraId}.json (la última) y por-id/{id}.json (las lee `learn.py`)
TRACKS = LIVE / "tracks"  # {cameraId}.json: recuadros por imagen para que la app siga el humo


@dataclass(frozen=True)
class Outcome:
    """Qué pasó con un foco o una cámara en el ciclo, para la consola y el registro."""

    camera_id: str | None
    hotspots: int
    result: str
    alert_id: str | None = None


@dataclass
class Tools:
    """Modelos cargados una vez y reusados en cada ciclo (cargarlos tarda varios segundos)."""

    fire: detect.FireDetector
    vehicles: materials.VehicleDetector | None = None

    @classmethod
    def load(cls) -> Tools:
        return cls(detect.FireDetector(), materials.VehicleDetector())


def run_cycle(tools: Tools, now: datetime | None = None) -> list[Outcome]:
    """Un ciclo completo: focos nuevos → cámaras → visión → Gemini → informe.

    Raises:
        firms_nrt.FirmsError: Si FIRMS no responde. Sin satélite no hay de dónde partir.
    """
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    camera_list = [camera for camera in cameras.load_cameras() if camera["provider"] in WATCHED_PROVIDERS]
    if not camera_list:
        return []
    seen = forget_old(read_json(SEEN, {}), now)
    fresh = recent_hotspots(camera_list, now)
    new = fresh[~fresh["key"].isin(seen)] if not fresh.empty else fresh
    outcomes = []
    if not new.empty:
        groups, orphans = hotspots_by_camera(new, camera_list)
        if orphans:
            outcomes.append(Outcome(None, orphans, "Sin cámara cerca: solo se anota"))
        last_alert = read_json(LAST_ALERT, {})
        for camera, rows in groups:
            if recently_alerted(last_alert.get(camera["id"]), now):
                outcomes.append(Outcome(camera["id"], len(rows), f"Ya alertada hace menos de {COOLDOWN_H} h"))
                continue
            outcome = check_camera(camera, rows, tools, now)
            if outcome.alert_id is not None:
                last_alert[camera["id"]] = now.isoformat(timespec="seconds")
            outcomes.append(outcome)
        write_json(LAST_ALERT, last_alert)
        seen.update({key: now.isoformat(timespec="seconds") for key in new["key"]})
    write_json(SEEN, seen)
    return outcomes


def recent_hotspots(camera_list: list[dict], now: datetime) -> pd.DataFrame:
    """Focos de las últimas 24 h en el recuadro que cubre todas las cámaras (más el radio).

    Se pide solo ese recuadro y no toda California: las cámaras del demo están en el distrito 2
    y un foco lejos de ellas no tiene imagen que mirar.
    """
    key = os.environ.get("FIRMS_MAP_KEY")
    if not key:
        raise firms_nrt.FirmsError("Falta FIRMS_MAP_KEY en ml/.env")
    boxes = [bbox_around(tuple(camera["position"]), CAMERA_RADIUS_KM) for camera in camera_list]
    area = ",".join(f"{value:.4f}" for value in (min(b[0] for b in boxes), min(b[1] for b in boxes),
                                                 max(b[2] for b in boxes), max(b[3] for b in boxes)))
    tables, errors = [], []
    for source in firms_nrt.SOURCES:
        try:
            tables.append(firms_nrt.hotspots(key, source, area))
        except (requests.RequestException, ValueError) as error:
            errors.append(f"{source}: {error}")
    if not tables:
        raise firms_nrt.FirmsError("Ninguna fuente de FIRMS respondió: " + "; ".join(errors))
    return with_keys(pd.concat(tables, ignore_index=True), now)


def with_keys(df: pd.DataFrame, now: datetime) -> pd.DataFrame:
    """Deja los focos de las últimas `MAX_HOURS` y les pone una clave única.

    La clave junta fuente, posición, fecha y hora: el mismo foco llega igual en cada consulta.
    """
    if df.empty:
        return df.assign(key=pd.Series(dtype=str))
    hours_ago = (now - firms_nrt.acquired_at(df)).dt.total_seconds() / 3600
    df = df[hours_ago.between(0, firms_nrt.MAX_HOURS)]
    keys = (df["source"] + "|" + df["latitude"].round(4).astype(str) + "|" + df["longitude"].round(4).astype(str)
            + "|" + df["acq_date"].astype(str) + "|" + df["acq_time"].astype(str))
    return df.assign(key=keys)


def hotspots_by_camera(hotspots_df: pd.DataFrame, camera_list: list[dict]) -> tuple[list[tuple[dict, pd.DataFrame]], int]:
    """Agrupa los focos por la cámara más cercana a menos de `CAMERA_RADIUS_KM`.

    Returns:
        `(cámara, focos)` de las cámaras con al menos un foco, y cuántos focos no tienen cámara.
    """
    nearest_ids = []
    for lon, lat in zip(hotspots_df["longitude"], hotspots_df["latitude"]):
        km, camera_id = min((distance_m((lon, lat), tuple(c["position"])) / 1000, c["id"]) for c in camera_list)
        nearest_ids.append(camera_id if km <= CAMERA_RADIUS_KM else None)
    assigned = hotspots_df.assign(camera_id=nearest_ids)
    by_id = {camera["id"]: camera for camera in camera_list}
    groups = [(by_id[camera_id], rows) for camera_id, rows in assigned.dropna(subset=["camera_id"]).groupby("camera_id")]
    return groups, int(assigned["camera_id"].isna().sum())


def check_camera(camera: dict, rows: pd.DataFrame, tools: Tools, now: datetime) -> Outcome:
    """Mira la cámara cercana a los focos y, si hay algo, manda el informe a la app."""
    position = tuple(camera["position"])
    firms = firms_nrt.nearest_match(rows, position, now)
    try:
        frames = cameras.fetch_recent_frames(camera, FRAMES_PER_CHECK)
    except (requests.RequestException, ValueError) as error:
        return Outcome(camera["id"], len(rows), f"La cámara no respondió: {error}")
    detection_id = f"det-{camera['id']}-{now:%Y%m%d%H%M}"

    if detect.is_night_at(position, now):
        detection = save_detection(camera, detection_id, now, frames[-1], frames[-1], [], [], tools)
        review = AgentReview(decision="revisar", confidence=0, reasons=[
            "De noche el modelo de visión no ve el humo; solo hay el foco satelital", night_reason(firms)])
        return send(detection, review, firms, [], None, len(rows), "De noche: queda para revisar")

    tracks = track.track_images(frames, tools.fire, night=False, seconds_between=camera["refreshSeconds"])
    regions = tracks[-1].regions
    persistent = track.longest_track(tracks) if len(frames) >= MIN_PERSISTENT_FRAMES else None
    if not regions and len(frames) > 1:
        regions, persistent = anomaly.find_anomalies(frames[-2], frames[-1]), None
    if not regions:
        return Outcome(camera["id"], len(rows), "Foco satelital cerca, pero la cámara no ve humo ni llama")

    nearby = nearby_materials(camera, frames[-1], tools)
    marked, can_mark = marked_image(camera, frames[-1], regions, nearby)
    detection = save_detection(camera, detection_id, now, frames[-1], marked, regions, nearby, tools)
    write_json(TRACKS / f"{camera['id']}.json", [frame.to_json() for frame in tracks])
    evidence = Evidence(detection=detection, firms=firms, persistent_frames=persistent)
    verdict = supervisor.supervise(evidence, annotate.encode_jpeg(marked), camera["name"])
    review = verdict.review
    if not can_mark:
        review = review.model_copy(update={"reasons": [*review.reasons, "Imagen sin marcas: la licencia no lo permite"]})
    fire_water = nearby_water(rows, position) if review.decision == "confirmar" and is_large_fire(evidence) else []
    return send(detection, review, firms, fire_water, verdict.draft, len(rows), f"Gemini: {review.decision}")


def send(detection: Detection, review: AgentReview, firms: FirmsMatch, fire_water: list[WaterSource],
         draft: AlertEmailDraft | None, hotspot_count: int, result: str) -> Outcome:
    """Arma el informe, lo manda a la app (o lo deja en `outbox/`) y devuelve el resultado."""
    built = report.build_report(detection, review, firms, fire_water, draft)
    delivered = report.deliver(built)
    note = "" if delivered is not None else " (la app no respondió: quedó en outbox)"
    return Outcome(detection.camera_id, hotspot_count, result + note, built.alert.id)


def night_reason(firms: FirmsMatch) -> str:
    """Razón con el foco satelital, la única prueba de noche."""
    if not firms.found:
        return f"FIRMS vio un foco en la zona, pero no a menos de {CAMERA_RADIUS_KM} km de la cámara"
    return f"Foco FIRMS ({firms.source}) a {report.decimal(firms.nearest_km)} km de la cámara, hace {round(firms.hours_ago)} h"


def nearby_materials(camera: dict, image: np.ndarray, tools: Tools) -> list[NearbyMaterial]:
    """Vehículos en la imagen y materiales de OpenStreetMap; si Overpass falla, sigue sin ellos."""
    found = tools.vehicles.detect(image) if tools.vehicles is not None else []
    try:
        found += materials.osm_materials(tuple(camera["position"]))
    except Exception:  # noqa: BLE001 - los materiales son un extra: no frenan una alerta
        pass
    return found


def nearby_water(rows: pd.DataFrame, camera_position: tuple[float, float]) -> list[WaterSource]:
    """Fuentes de agua alrededor del foco más cercano a la cámara (no de la cámara: el fuego está ahí)."""
    distances = [distance_m(camera_position, (lon, lat)) for lon, lat in zip(rows["longitude"], rows["latitude"])]
    best = rows.iloc[int(np.argmin(distances))]
    try:
        return water.water_sources((float(best["longitude"]), float(best["latitude"])))
    except Exception:  # noqa: BLE001 - sin Overpass el correo sale igual, sin la lista de agua
        return []


def marked_image(camera: dict, image: np.ndarray, regions: list[FireRegion],
                 nearby: list[NearbyMaterial]) -> tuple[np.ndarray, bool]:
    """La imagen con recuadros, o la original si el dueño de la cámara no permite marcarla."""
    try:
        return annotate.annotate_camera(camera, image, regions, nearby), True
    except annotate.NotMarkableError:
        return image, False


def save_detection(camera: dict, detection_id: str, now: datetime, frame: np.ndarray, marked: np.ndarray,
                   regions: list[FireRegion], nearby: list[NearbyMaterial], tools: Tools) -> Detection:
    """Guarda las dos imágenes y la detección donde las lee la app."""
    frame_name, marked_name = f"{detection_id}.jpg", f"{detection_id}-marcada.jpg"
    FRAMES.mkdir(parents=True, exist_ok=True)
    (FRAMES / frame_name).write_bytes(annotate.encode_jpeg(frame))
    (FRAMES / marked_name).write_bytes(annotate.encode_jpeg(marked))
    detection = Detection(
        id=detection_id, camera_id=camera["id"], captured_at=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        frame_url=f"{FRAMES_URL}/{frame_name}", annotated_url=f"{FRAMES_URL}/{marked_name}",
        regions=regions, materials=nearby, model=tools.fire.info,
    )
    write_json(DETECTIONS / f"{camera['id']}.json", detection.to_json())
    write_json(DETECTIONS / "por-id" / f"{detection_id}.json", detection.to_json())
    return detection


def recently_alerted(last: str | None, now: datetime) -> bool:
    """Si la cámara ya mandó una alerta hace menos de `COOLDOWN_H` horas."""
    return last is not None and now - datetime.fromisoformat(last) < timedelta(hours=COOLDOWN_H)


def forget_old(seen: dict[str, str], now: datetime) -> dict[str, str]:
    """Olvida los focos vistos hace más de `SEEN_KEEP_H`: FIRMS ya no los devuelve."""
    limit = now - timedelta(hours=SEEN_KEEP_H)
    return {key: when for key, when in seen.items() if datetime.fromisoformat(when) >= limit}
