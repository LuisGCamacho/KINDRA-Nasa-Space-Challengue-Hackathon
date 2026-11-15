"""Aprendizaje de falsos positivos: se anota por qué el sistema se equivocó.

Lee la cola que llena la app cuando alguien toca "Marcar como falso positivo" y escribe un
`FalsePositiveLog` por caso en `ml/data/false_positives/` (no se sube a Git). **No cambia el modelo
ni los umbrales**: propone, y el equipo decide si ajusta una regla o reentrena (AGENTS.md).

El diagnóstico tiene dos niveles:
- **Reglas (siempre):** causas que se saben sin mirar la imagen, como una anomalía sola o una
  detección débil.
- **LLM (opcional):** `process_queue(diagnose=...)` recibe una función que mira la imagen. Sin
  ella (por ejemplo, sin la clave de Gemini) se usan solo las reglas.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from kindra.agent.rules import DISCARD_BELOW, only_anomalies, top_confidence
from kindra.contracts import Detection, FalsePositiveLog, FalsePositiveSuggestion
from kindra.live_paths import FALSE_POSITIVE_LOGS, LIVE, read_json, write_json

QUEUE = LIVE / "false-positive-queue.json"  # la escribe la app: [{ alertId, note }]
ALERTS = LIVE / "fire-alerts.json"  # la escribe la app
DETECTIONS = LIVE / "detections" / "por-id"  # la escribe `agent/pipeline.py`: {id}.json
DONE = FALSE_POSITIVE_LOGS / "procesadas.json"  # Python no toca la cola: anota aquí lo que ya leyó
WEAK_MARGIN = 0.15  # una detección hasta 0,15 por encima del corte se considera "apenas pasó"


@dataclass(frozen=True)
class Diagnosis:
    """Causa probable y un solo cambio propuesto."""

    probable_cause: str
    suggestion: FalsePositiveSuggestion


Diagnose = Callable[[Detection, str | None], Diagnosis]


def process_queue(diagnose: Diagnose | None = None, now: datetime | None = None) -> list[FalsePositiveLog]:
    """Escribe un log por cada falso positivo nuevo de la cola y devuelve los escritos.

    Args:
        diagnose: Diagnóstico con LLM (mira la imagen). Si falta o falla, se usan las reglas.
        now: Momento del registro; por defecto, ahora (UTC).
    """
    done = set(read_json(DONE, []))
    alerts = {alert["id"]: alert for alert in read_json(ALERTS, [])}
    logs = []
    for item in read_json(QUEUE, []):
        alert = alerts.get(item.get("alertId"))
        if alert is None or alert["id"] in done:
            continue
        stored = read_json(DETECTIONS / f"{alert['detectionId']}.json", None)
        if stored is None:
            continue  # la detección todavía no se guardó: se reintenta en la próxima pasada
        detection = Detection.model_validate(stored)
        note = item.get("note") or None
        log = make_log(alert["id"], detection, note, diagnose_safely(detection, note, diagnose), now)
        write_json(FALSE_POSITIVE_LOGS / f"{log.id}.json", log.to_json())
        done.add(alert["id"])
        logs.append(log)
    write_json(DONE, sorted(done))
    return logs


def diagnose_safely(detection: Detection, note: str | None, diagnose: Diagnose | None) -> Diagnosis:
    """El diagnóstico del LLM si hay y responde; si no, el de las reglas. Nunca deja un caso sin anotar."""
    if diagnose is not None:
        try:
            return diagnose(detection, note)
        except Exception:  # noqa: BLE001 - cualquier falla del LLM cae a las reglas, no corta la cola
            pass
    return rule_diagnosis(detection, note)


def rule_diagnosis(detection: Detection, note: str | None) -> Diagnosis:
    """Causa probable que se puede saber sin mirar la imagen.

    El orden importa: va de lo más seguro (solo hubo anomalías de color) a lo más general.
    """
    if only_anomalies(detection):
        return Diagnosis(
            "Solo hubo cambios de color, sin humo ni llama del detector (luces, reflejos o atardecer)",
            FalsePositiveSuggestion(kind="regla", detail="Pedir que la anomalía dure 3 imágenes antes de alertar"),
        )
    if top_confidence(detection) < DISCARD_BELOW + WEAK_MARGIN:
        return Diagnosis(
            "Detección débil que apenas pasó el corte de confianza",
            FalsePositiveSuggestion(kind="umbral", detail="Revisar si conviene subir el corte de descarte del agente"),
        )
    cause = f"Marcado por una persona: {note}" if note else "Pendiente: revisar la imagen a mano"
    return Diagnosis(cause, FalsePositiveSuggestion(
        kind="reentrenar", detail="Guardar la imagen como ejemplo de fondo (sin fuego) si se repite el caso"))


def make_log(alert_id: str, detection: Detection, note: str | None, diagnosis: Diagnosis,
             now: datetime | None = None) -> FalsePositiveLog:
    """Arma el `FalsePositiveLog` del contrato."""
    created = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return FalsePositiveLog(
        id=f"fp-{uuid.uuid4().hex[:12]}",
        alert_id=alert_id,
        detection_id=detection.id,
        annotated_url=detection.annotated_url,
        detected=detection.regions,
        human_note=note,
        probable_cause=diagnosis.probable_cause,
        suggestion=diagnosis.suggestion,
        created_at=created.isoformat(timespec="seconds"),
    )
