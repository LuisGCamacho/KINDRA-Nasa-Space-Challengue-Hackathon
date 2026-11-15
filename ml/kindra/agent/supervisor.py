"""Supervisor del agente: Gemini revisa cada detección y las reglas ponen los límites.

Orden de una revisión:

1. **Reglas antes del LLM** (`rules.decide_without_llm`): una detección débil o que dura pocos
   cuadros se descarta sin gastar un pedido.
2. **Gemini mira la imagen marcada** junto con los datos verificados (cámara, regiones, foco de
   FIRMS) y propone `confirmar`, `descartar` o `revisar`, con razones y el texto del correo.
3. **Reglas después del LLM** (`rules.limit_decision`): una anomalía de color sola no se confirma
   si FIRMS tampoco vio nada.
4. **Cifras del correo** (`numbers_guard`): si el texto de Gemini trae una cifra que no está en
   los datos, se usa la plantilla fija.

Si Gemini no está configurado o falla, la alerta queda en `revisar`: nunca se confirma un
incendio sin que alguien (el LLM o una persona) haya mirado la imagen.
"""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, Field

from kindra.agent import llm_client
from kindra.agent.numbers_guard import invented_numbers
from kindra.agent.report import decimal, template_draft
from kindra.agent.rules import DISCARD_BELOW, Evidence, decide_without_llm, limit_decision, top_confidence
from kindra.contracts import AgentDecision, AgentReview, AlertEmailDraft

MAX_REASONS = 4  # razones que se guardan en la alerta; más no se leen en la app

SYSTEM = """Eres el verificador de incendios de KINDRA. Miras la imagen de una cámara de carretera
de California con las regiones que marcó un modelo de visión (cajas de humo, llama o cambio de color).

Decide una de tres:
- "confirmar": se ve humo o fuego real en la imagen.
- "descartar": lo marcado es otra cosa (nube, niebla, polvo, reflejo, luces, puesta de sol).
- "revisar": no se puede saber con la imagen; la mira una persona.

Reglas:
- Usa solo la imagen y los datos que te paso. No inventes cifras, lugares ni horas.
- Un foco satelital cerca apoya el incendio, pero no lo confirma solo: tiene que verse en la imagen.
- Si dudas, elige "revisar".
- Escribe en español, con frases cortas.
- "headline" y "summary" son el título y el texto del correo de alerta; solo se usan si confirmas."""


class LLMVerdict(BaseModel):
    """Forma de la respuesta que se le pide a Gemini."""

    decision: AgentDecision
    confidence: float = Field(ge=0, le=1, description="Qué tan seguro estás, de 0 a 1")
    reasons: list[str] = Field(description="De 1 a 4 razones cortas de lo que se ve en la imagen")
    headline: str = Field(description="Título del correo, sin cifras")
    summary: str = Field(description="Dos o tres frases para quien recibe la alerta")


@dataclass(frozen=True)
class Verdict:
    """Resultado de la revisión: lo que va en la alerta y, si se confirmó, el texto del correo."""

    review: AgentReview
    draft: AlertEmailDraft | None


def supervise(evidence: Evidence, annotated_jpeg: bytes, camera_name: str) -> Verdict:
    """Revisa una detección con reglas y Gemini.

    Args:
        evidence: Detección, coincidencia con FIRMS y cuadros en que siguió el humo.
        annotated_jpeg: Imagen con las cajas marcadas (`vision.annotate`), la que mira Gemini.
        camera_name: Nombre de la cámara para el correo.
    """
    if decide_without_llm(evidence) == "descartar":
        return Verdict(rule_review(evidence), None)
    facts = case_facts(evidence, camera_name)
    try:
        answer = llm_client.ask(SYSTEM, facts, LLMVerdict, annotated_jpeg)
    except llm_client.LLMUnavailable as error:
        return Verdict(unreviewed(evidence, str(error)), None)
    decision = limit_decision(answer.decision, evidence)
    reasons = [reason for reason in answer.reasons if reason.strip()][:MAX_REASONS]
    if decision != answer.decision:
        reasons.append("Solo hubo un cambio de color y FIRMS no vio focos: la revisa una persona")
    review = AgentReview(decision=decision, confidence=answer.confidence, reasons=reasons or ["Sin razones del LLM"])
    draft = checked_draft(answer, facts, camera_name, evidence) if decision == "confirmar" else None
    return Verdict(review, draft)


def checked_draft(answer: LLMVerdict, facts: str, camera_name: str, evidence: Evidence) -> AlertEmailDraft:
    """El texto de Gemini si no inventó cifras; si no, la plantilla fija con datos verificados."""
    text = f"{answer.headline} {answer.summary}"
    if answer.headline.strip() and answer.summary.strip() and not invented_numbers(text, facts):
        return AlertEmailDraft(headline=answer.headline.strip(), summary=answer.summary.strip())
    return template_draft(camera_name, evidence.detection, evidence.firms)


def rule_review(evidence: Evidence) -> AgentReview:
    """Descarte por reglas, con la razón que corresponde."""
    top = top_confidence(evidence.detection)
    if evidence.persistent_frames is not None and top >= DISCARD_BELOW:
        reason = f"El humo siguió solo {evidence.persistent_frames} cuadros: probablemente una nube o un reflejo"
    else:
        reason = f"Detección débil (confianza {round(top * 100)} %)"
    # Cuanto más débil la detección, más seguro el descarte: por eso 1 menos la confianza del detector.
    return AgentReview(decision="descartar", confidence=1 - top, reasons=[reason])


def unreviewed(evidence: Evidence, error: str) -> AgentReview:
    """Alerta que nadie revisó todavía: queda en `revisar` con la confianza del detector."""
    return AgentReview(decision="revisar", confidence=top_confidence(evidence.detection),
                       reasons=["Gemini no pudo revisar la imagen; la revisa una persona", error[:200]])


def case_facts(evidence: Evidence, camera_name: str) -> str:
    """Datos verificados del caso, en texto. Es también la lista de cifras que el correo puede usar."""
    detection, firms = evidence.detection, evidence.firms
    lines = [f"Cámara: {camera_name}", f"Hora de la imagen (UTC): {detection.captured_at}"]
    for region in detection.regions:
        lines.append(f"Región marcada: {region.label}, confianza {round(region.confidence * 100)} %, "
                     f"cubre el {decimal(round(region.box.area * 100, 1))} % de la imagen")
    if evidence.persistent_frames is not None:
        lines.append(f"Cuadros seguidos con el mismo humo: {evidence.persistent_frames}")
    if firms.found:
        lines.append(f"Foco satelital FIRMS ({firms.source}) a {decimal(firms.nearest_km)} km, "
                     f"hace {round(firms.hours_ago)} h")
    else:
        lines.append("FIRMS: sin focos cerca en las últimas 24 h")
    materials = sorted({material.label for material in detection.materials})
    if materials:
        lines.append("Cerca: " + ", ".join(materials))
    return "\n".join(lines)
