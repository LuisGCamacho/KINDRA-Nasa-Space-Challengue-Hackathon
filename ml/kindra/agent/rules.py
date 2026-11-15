"""Reglas fijas del agente. El LLM propone; estas reglas ponen los límites.

Las reglas son código común, con pruebas: lo que no se puede discutir (una anomalía sola no
confirma un incendio, una detección débil se descarta) no se deja en manos del LLM.
"""

from __future__ import annotations

from dataclasses import dataclass

from kindra.contracts import AgentDecision, Detection, FirmsMatch

DISCARD_BELOW = 0.35  # confianza máxima (0–1) debajo de la cual se descarta sin preguntar al LLM
LARGE_FIRE_AREA = 0.05  # humo o llama que cubre el 5 % de la imagen o más
MIN_PERSISTENT_FRAMES = 3  # en video, el mismo humo tiene que seguir al menos 3 cuadros


@dataclass(frozen=True)
class Evidence:
    """Todo lo que el agente sabe de una detección antes de decidir."""

    detection: Detection
    firms: FirmsMatch
    #: Cuadros en que siguió el mismo humo; `None` si es una foto suelta.
    persistent_frames: int | None


def decide_without_llm(evidence: Evidence) -> AgentDecision | None:
    """Decide los casos claros sin preguntar al LLM.

    Returns:
        `descartar` si la detección es débil o, en video, dura muy pocos cuadros (probablemente
        una nube o un reflejo que pasa). `None` significa "que lo revise el LLM".
    """
    if top_confidence(evidence.detection) < DISCARD_BELOW:
        return "descartar"
    if evidence.persistent_frames is not None and evidence.persistent_frames < MIN_PERSISTENT_FRAMES:
        return "descartar"
    return None


def limit_decision(proposed: AgentDecision, evidence: Evidence) -> AgentDecision:
    """Limita la decisión del LLM: una anomalía sola no se confirma si FIRMS tampoco vio nada.

    En ese caso la decisión pasa a `revisar`, para que la mire una persona.
    """
    if proposed == "confirmar" and only_anomalies(evidence.detection) and not evidence.firms.found:
        return "revisar"
    return proposed


def is_large_fire(evidence: Evidence) -> bool:
    """Incendio grande: humo o llama sobre el 5 % de la imagen, o un foco FIRMS cerca.

    Solo en ese caso se buscan fuentes de agua, para no gastar pedidos a Overpass.
    """
    area = sum(r.box.area for r in evidence.detection.regions if r.label != "anomalia")
    return area >= LARGE_FIRE_AREA or evidence.firms.found


def top_confidence(detection: Detection) -> float:
    """Confianza más alta entre las regiones de la detección."""
    return max(region.confidence for region in detection.regions)


def only_anomalies(detection: Detection) -> bool:
    """Indica si todas las regiones son anomalías de color, sin humo ni llama del detector."""
    return all(region.label == "anomalia" for region in detection.regions)
