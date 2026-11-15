"""Arma el informe del agente y lo manda a la app (`POST /api/fire-alerts`).

Python decide; la app guarda la alerta y manda el único correo (Python nunca manda correos).
Si la app no responde, el informe queda en `web/data/live/outbox/` y `send_pending` lo reintenta:
una alerta no se pierde porque la app estaba apagada.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import requests

from kindra.contracts import AgentReport, AgentReview, AlertEmailDraft, Detection, FireAlert, FirmsMatch, WaterSource
from kindra.live_paths import LIVE, read_json, write_json

OUTBOX = LIVE / "outbox"  # informes que todavía no llegaron a la app (no se sube a Git)
TIMEOUT_S = 60
FIRE_NAME = {"humo": "humo", "llama": "llamas", "anomalia": "un cambio de color"}


class ReportError(RuntimeError):
    """La app no recibió el informe: falta configuración o respondió con error."""


def build_report(detection: Detection, review: AgentReview, firms: FirmsMatch, water: list[WaterSource],
                 draft: AlertEmailDraft | None, created_at: datetime | None = None) -> AgentReport:
    """Arma el `AgentReport` que espera la API.

    La alerta sale `pendiente` (la API la pasa a `enviada` cuando sale el correo) o `descartada`.
    El texto del correo solo va si el agente confirmó; si no, `draft` es `None` y no hay correo.
    """
    created = (created_at or datetime.now(timezone.utc)).astimezone(timezone.utc)
    discarded = review.decision == "descartar"
    alert = FireAlert(
        id=f"alerta-{detection.id}",
        detection_id=detection.id,
        camera_id=detection.camera_id,
        created_at=created.strftime("%Y-%m-%dT%H:%M:%SZ"),
        status="descartada" if discarded else "pendiente",
        agent=review,
        firms=firms,
        water=water,
    )
    return AgentReport(alert=alert, detection=detection, draft=draft if review.decision == "confirmar" else None)


def template_draft(camera_name: str, detection: Detection, firms: FirmsMatch) -> AlertEmailDraft:
    """Texto fijo del correo, armado solo con datos verificados.

    Se usa cuando el LLM no respondió o su texto trajo una cifra que no estaba en los datos
    (`numbers_guard`): así nunca sale una cifra inventada.
    """
    labels = sorted({region.label for region in detection.regions}, key=["llama", "humo", "anomalia"].index)
    seen = " y ".join(FIRE_NAME[label] for label in labels) or "algo"
    top = max((region.confidence for region in detection.regions), default=0)
    firms_text = (f" Un satélite ({firms.source}) vio un foco a {decimal(firms.nearest_km)} km hace "
                  f"{round(firms.hours_ago)} h." if firms.found else " FIRMS no registró focos cerca en las últimas 24 h.")
    return AlertEmailDraft(
        headline=f"Posible incendio en {camera_name}",
        summary=(f"El modelo de visión marcó {seen} en la imagen (confianza {round(top * 100)} %)."
                 f"{firms_text} Revisa la foto y confirma o descarta la alerta."),
    )


def decimal(value: float) -> str:
    """Número con coma decimal y sin ceros de más, como en la app: 2.0 → "2", 2.5 → "2,5"."""
    return f"{value:g}".replace(".", ",")


def deliver(report: AgentReport) -> dict | None:
    """Manda el informe; si la app no responde, lo deja en la bandeja de salida.

    Returns:
        La respuesta de la app, o `None` si quedó en `outbox/` para reintentar.
    """
    try:
        return post_report(report)
    except ReportError:
        write_json(OUTBOX / f"{report.alert.id}.json", report.to_json())
        return None


def post_report(report: AgentReport) -> dict:
    """`POST /api/fire-alerts` con `Bearer AGENT_SECRET`. Devuelve lo que responde la app.

    Raises:
        ReportError: Si faltan `APP_URL` o `AGENT_SECRET`, o la app no responde bien.
    """
    app_url, secret = os.environ.get("APP_URL"), os.environ.get("AGENT_SECRET")
    if not app_url or not secret:
        raise ReportError("Faltan APP_URL o AGENT_SECRET en ml/.env")
    try:
        response = requests.post(f"{app_url.rstrip('/')}/api/fire-alerts", json=report.to_json(),
                                 headers={"Authorization": f"Bearer {secret}"}, timeout=TIMEOUT_S)
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as error:
        raise ReportError(f"La app no recibió el informe {report.alert.id}: {error}") from error


def send_pending() -> tuple[int, int]:
    """Reintenta los informes de la bandeja de salida. Devuelve `(enviados, pendientes)`."""
    sent = pending = 0
    for path in sorted(OUTBOX.glob("*.json")):
        try:
            post_report(AgentReport.model_validate(read_json(path, None)))
        except ReportError:
            pending += 1
            continue
        path.unlink()
        sent += 1
    return sent, pending
