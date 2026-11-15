"""Comandos del agente: `python -m kindra agent watch | demo | learn`.

- `watch`: vigila sin parar. Cada ciclo reintenta los informes de `outbox/` y corre
  `pipeline.run_cycle` (FIRMS → cámara → visión → Gemini → informe).
- `demo`: sigue el humo en el video de la demo y deja el recorrido para la app.
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
         camera_id: str = typer.Option("demo", help="Id de la cámara de la demo en cameras.json.")) -> None:
    """Sigue el humo del video a 5 cuadros por segundo -> web/data/live/tracks/{camera_id}.json."""
    from kindra.agent.pipeline import TRACKS
    from kindra.live_paths import write_json
    from kindra.vision import detect, track

    frames = track.track_video(video, detect.FireDetector())
    write_json(TRACKS / f"{camera_id}.json", [frame.to_json() for frame in frames])
    typer.echo(f"{len(frames)} cuadros · el humo que más duró aparece en {track.longest_track(frames)} cuadros")


@agent_app.command()
def learn() -> None:
    """Anota los falsos positivos de la cola en ml/data/false_positives/ (no cambia el modelo)."""
    from kindra.agent import learn as false_positives

    logs = false_positives.process_queue()
    typer.echo(f"{len(logs)} falsos positivos nuevos anotados")
    for log in logs:
        typer.echo(f"  {log.alert_id}: {log.probable_cause} -> {log.suggestion.kind}: {log.suggestion.detail}")
