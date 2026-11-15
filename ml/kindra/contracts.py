"""Contratos de KINDRA 4 en Python: la misma forma que `web/src/lib/alert-types.ts`.

Los modelos usan nombres en snake_case dentro de Python y se guardan en camelCase
(`by_alias=True`), que es lo que lee la app. Si cambia un campo aquí, cambia también en
TypeScript y en `agent-report-schema.ts`: es un contrato compartido.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

FireLabel = Literal["humo", "llama", "anomalia"]
MaterialLabel = Literal["vegetacion", "auto", "edificio", "tanque_combustible"]
WaterKind = Literal["hidrante", "rio", "lago", "represa"]
AgentDecision = Literal["confirmar", "descartar", "revisar"]
LonLat = tuple[float, float]


class Contract(BaseModel):
    """Base de todos los contratos: alias en camelCase y sin campos de más."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    def to_json(self) -> dict:
        return self.model_dump(mode="json", by_alias=True)


class Box(Contract):
    """Recuadro normalizado a la imagen (0–1), desde la esquina superior izquierda."""

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(ge=0, le=1)
    h: float = Field(ge=0, le=1)

    @property
    def area(self) -> float:
        return self.w * self.h


class FireRegion(Contract):
    label: FireLabel
    confidence: float = Field(ge=0, le=1)
    box: Box
    track_id: int | None = None


class NearbyMaterial(Contract):
    label: MaterialLabel
    source: Literal["imagen", "osm"]
    box: Box | None = None
    distance_m: float | None = None


class ModelInfo(Contract):
    name: str
    version: str


class Detection(Contract):
    id: str
    camera_id: str
    captured_at: str
    frame_url: str
    annotated_url: str
    regions: list[FireRegion]
    materials: list[NearbyMaterial]
    model: ModelInfo


class TrackFrame(Contract):
    t: float
    regions: list[FireRegion]


class FirmsMatch(Contract):
    found: bool
    nearest_km: float | None = None
    hours_ago: float | None = None
    source: str | None = None


class WaterSource(Contract):
    id: str
    kind: WaterKind
    name: str | None
    position: LonLat
    distance_m: float


class AgentReview(Contract):
    decision: AgentDecision
    confidence: float = Field(ge=0, le=1)
    reasons: list[str]


class FireAlert(Contract):
    id: str
    detection_id: str
    camera_id: str
    created_at: str
    status: Literal["pendiente", "descartada"]
    agent: AgentReview
    firms: FirmsMatch
    water: list[WaterSource]
    emailed_at: None = None


class AlertEmailDraft(Contract):
    headline: str
    summary: str


class AgentReport(Contract):
    alert: FireAlert
    detection: Detection
    draft: AlertEmailDraft | None


class FalsePositiveSuggestion(Contract):
    kind: Literal["umbral", "regla", "reentrenar"]
    detail: str


class FalsePositiveLog(Contract):
    id: str
    alert_id: str
    detection_id: str
    annotated_url: str
    detected: list[FireRegion]
    human_note: str | None
    probable_cause: str
    suggestion: FalsePositiveSuggestion
    created_at: str
