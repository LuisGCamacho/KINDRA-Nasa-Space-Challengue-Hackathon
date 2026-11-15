"""Comandos del agente: `python -m kindra agent watch | demo | learn`.

- `watch`: vigila sin parar. Cada ciclo reintenta los informes de `outbox/` y corre
  `pipeline.run_cycle` (FIRMS → cámara → visión → Gemini → informe).
- `demo`: sigue el humo en el video de la demo y deja el recorrido para la app.
- `ensayo`: repite el incendio Palisades real paso a paso, para la presentación.
- `learn`: anota los falsos positivos que marcaron en la app.

Como en `kindra/__main__.py`, cada comando importa sus módulos adentro: así `--help` no carga
torch ni los modelos.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path

import typer

agent_app = typer.Typer(help="Agente: satélite -> cámara -> visión -> Gemini -> correo.", no_args_is_help=True)

VIIRS_CONFIDENCE = {"l": "baja", "n": "nominal", "h": "alta"}  # FIRMS escribe la de VIIRS con una letra
DEFAULT_EVERY_MIN = 30  # minutos entre ciclos: FIRMS NRT publica cada pasada de satélite, no más seguido


@agent_app.command()
def watch(every: int = typer.Option(DEFAULT_EVERY_MIN, help="Minutos entre ciclos."),
          once: bool = typer.Option(False, help="Correr un solo ciclo y salir.")) -> None:
    """Vigila los focos de FIRMS y revisa las cámaras cercanas. Ctrl+C para parar."""
    from kindra.agent import firms_nrt, pipeline, report

    typer.echo("Cargando modelos de visión...")
    tools = pipeline.Tools.load()
    while True:
        started = datetime.now(timezone.utc)
        sent, pending = report.send_pending()
        if sent or pending:
            typer.echo(f"Outbox: {sent} enviados, {pending} pendientes")
        try:
            outcomes = pipeline.run_cycle(tools, started)
        except firms_nrt.FirmsError as error:  # FIRMS caído: se reintenta en el próximo ciclo
            typer.echo(f"{started:%H:%M} UTC · FIRMS no respondió: {error}")
            outcomes = None
        if outcomes is not None:
            typer.echo(f"{started:%H:%M} UTC · {len(outcomes) or 'sin'} novedades")
            for outcome in outcomes:
                where = outcome.camera_id or "sin cámara"
                typer.echo(f"  {where}: {outcome.hotspots} focos · {outcome.result}")
        if once:
            return
        time.sleep(every * 60)


@agent_app.command()
def demo(video: Path = typer.Argument(..., exists=True, dir_okay=False, help="Video de la demo (.mp4)."),
         camera_id: str = typer.Option("demo-video", help="Id de la cámara de la demo en cameras.json.")) -> None:
    """Sigue el humo del video a 5 cuadros por segundo -> web/data/live/tracks/{camera_id}.json."""
    from kindra.agent.pipeline import TRACKS
    from kindra.live_paths import write_json
    from kindra.vision import detect, track

    frames = track.track_video(video, detect.FireDetector())
    write_json(TRACKS / f"{camera_id}.json", [frame.to_json() for frame in frames])
    typer.echo(f"{len(frames)} cuadros · el humo que más duró aparece en {track.longest_track(frames)} cuadros")


@agent_app.command()
def ensayo(pausa: bool = typer.Option(False, help="Esperar Enter entre pasos (para presentar en vivo)."),
           enviar: bool = typer.Option(True, help="Mandar el informe a la app; con --no-enviar no hay alerta ni correo.")) -> None:
    """Repite el incendio Palisades (7/1/2025): satélite -> cámara -> visión -> Gemini -> correo."""
    from datetime import datetime, timezone

    from kindra.agent import pipeline, rehearsal, report, supervisor
    from kindra.agent.rules import MIN_PERSISTENT_FRAMES, Evidence, is_large_fire
    from kindra.vision import annotate, cameras, track

    def step(number: int, title: str) -> None:
        if pausa and number > 1:
            typer.prompt("\n[Enter para seguir]", default="", show_default=False, prompt_suffix="")
        typer.secho(f"\n{number}. {title}", bold=True)

    def hhmm(when: datetime) -> str:
        return f"{when:%H:%M} UTC"

    camera = cameras.get_camera(rehearsal.CAMERA_ID)
    position = tuple(camera["position"])
    typer.echo(f"Ensayo: incendio Palisades, 7/1/2025 · {rehearsal.CREDIT}")
    video = rehearsal.ensure_video()

    step(1, "Satélite: FIRMS")
    day = rehearsal.archive_hotspots(f"{rehearsal.IGNITION:%Y-%m-%d}")
    sat = rehearsal.first_pass(day, position, rehearsal.IGNITION)
    if sat is None:
        typer.echo("FIRMS no tiene focos cerca de la cámara después de la ignición")
        raise typer.Exit(1)
    nearest = sat.hotspots.iloc[0]
    typer.echo(f"   {hhmm(sat.when)} · pasa {sat.match.source}: {len(sat.hotspots)} focos a menos de "
               f"{pipeline.CAMERA_RADIUS_KM} km de la cámara")
    typer.echo(f"   El más cercano: {report.decimal(sat.match.nearest_km)} km de {camera['name']} "
               f"(FRP {report.decimal(round(float(nearest['frp']), 1))} MW, confianza {VIIRS_CONFIDENCE.get(str(nearest['confidence']), nearest['confidence'])})")

    step(2, "Cámara: revisar lo que grabó")
    typer.echo(f"   {camera['name']} · mira al sur, sobre Pacific Palisades")
    typer.echo(f"   Imágenes de {hhmm(rehearsal.frame_time(0))} en adelante, una por minuto")

    step(3, "Visión: Pyronear (humo) + D-Fire (llama), con seguimiento")
    tools = pipeline.Tools.load()

    def narrate(index: int, when: datetime, regions: list) -> None:
        if regions and index % 5 == 0:
            best = max(regions, key=lambda region: region.confidence)
            typer.echo(f"   {hhmm(when)} (min {rehearsal.minutes_after_ignition(when):+d}) · {best.label} "
                       f"{round(best.confidence * 100)} %, {report.decimal(round(best.box.area * 100, 1))} % de la imagen")

    seen = rehearsal.review_video(video, tools.fire, narrate)
    persistent = track.longest_track(seen.frames)
    regions = seen.frames[-1].regions
    if seen.first_seen is None or not regions:
        typer.echo("El detector no vio humo en el video")
        raise typer.Exit(1)
    _, first_time = seen.first_seen
    typer.echo(f"   Primer humo: {hhmm(first_time)}, {rehearsal.minutes_after_ignition(first_time)} min después de la "
               f"ignición · el mismo humo sigue {persistent} imágenes (mínimo {MIN_PERSISTENT_FRAMES})")
    pipeline.write_json(pipeline.TRACKS / f"{camera['id']}.json", [frame.to_json() for frame in seen.frames])

    step(4, "Agente: reglas + Gemini")
    detection_id = f"det-{camera['id']}-ensayo-{datetime.now(timezone.utc):%Y%m%d%H%M%S}"
    nearby = pipeline.nearby_materials(camera, seen.last_image, tools)
    marked, _ = pipeline.marked_image(camera, seen.last_image, regions, nearby)
    detection = pipeline.save_detection(camera, detection_id, seen.last_time, seen.last_image, marked,
                                        regions, nearby, tools)
    evidence = Evidence(detection=detection, firms=sat.match, persistent_frames=persistent)
    verdict = supervisor.supervise(evidence, annotate.encode_jpeg(marked), camera["name"])
    review = verdict.review
    typer.echo(f"   Decisión: {review.decision} (confianza {round(review.confidence * 100)} %)")
    for reason in review.reasons:
        typer.echo(f"   - {reason}")

    step(5, "Informe y correo")
    if not enviar:
        typer.echo("   --no-enviar: no se manda nada a la app")
        return
    fire_water = (pipeline.nearby_water(sat.hotspots, position)
                  if review.decision == "confirmar" and is_large_fire(evidence) else [])
    if fire_water:
        typer.echo(f"   Agua cerca del foco: {len(fire_water)} fuentes")
    built = report.build_report(detection, review, sat.match, fire_water, verdict.draft)
    points = rehearsal.fire_points(day, position, rehearsal.IGNITION)
    pipeline.save_hotspots(built.alert.id, points)
    sensors = ", ".join(f"{sum(p.sensor == s for p in points)} {s}" for s in ("VIIRS", "MODIS"))
    typer.echo(f"   Focos del día para el mapa: {sensors}")
    answer = report.deliver(built)
    if answer is None:
        typer.echo("   La app no respondió: el informe quedó en outbox (se reintenta con `agent watch`)")
    elif answer.get("email"):
        typer.echo(f"   Alerta {built.alert.id} guardada · correo enviado")
    elif answer.get("emailError"):
        typer.echo(f"   Alerta {built.alert.id} guardada · el correo falló: {answer['emailError']}")
    else:
        typer.echo(f"   Alerta {built.alert.id} guardada · sin correo (decisión: {review.decision})")


@agent_app.command()
def learn() -> None:
    """Anota los falsos positivos de la cola en ml/data/false_positives/ (no cambia el modelo)."""
    from kindra.agent import learn as false_positives

    logs = false_positives.process_queue()
    typer.echo(f"{len(logs)} falsos positivos nuevos anotados")
    for log in logs:
        typer.echo(f"  {log.alert_id}: {log.probable_cause} -> {log.suggestion.kind}: {log.suggestion.detail}")
