import type { Camera, Detection, FireAlert, NearbyMaterial } from "@/lib/alert-types";
import { MATERIAL_NAME, WATER_NAME } from "@/lib/colors";
import { FIRE_LABEL_NAME, formatConfidence } from "@/lib/detection-text";
import { formatDistance, googleMapsUrl } from "@/lib/geo";
import { num } from "@/lib/format";
import { formatCaliforniaTime } from "./california-time";

/** Una fila del correo. HTML y texto plano usan la misma lista: así nunca dicen cosas distintas. */
export interface EmailFact {
  label: string;
  value: string;
  href?: string;
}

export interface AlertEmailInput {
  alert: FireAlert;
  detection: Detection;
  camera: Camera;
}

/** Se listan hasta tres fuentes de agua: más no ayudan a decidir. */
const MAX_WATER_SOURCES = 3;

function describeMaterial(material: NearbyMaterial): string {
  const where = material.source === "osm" ? "según OpenStreetMap" : "en la imagen";
  const distance = material.distanceM === null ? "" : ` a ${formatDistance(material.distanceM)}`;
  return `${MATERIAL_NAME[material.label]}${distance} (${where})`;
}

function describeFirms({ firms }: FireAlert): string {
  if (!firms.found) return "No. Sin focos de calor cerca en las últimas 24 h.";
  const distance = firms.nearestKm === null ? "" : ` a ${num(firms.nearestKm, 1)} km`;
  const hours = firms.hoursAgo === null ? "" : `, hace ${num(firms.hoursAgo)} h`;
  return `Sí. Foco ${firms.source ?? "FIRMS"}${distance}${hours}.`;
}

/** Datos del correo, todos sacados de la alerta y la detección: ninguno lo escribe el LLM. */
export function buildEmailFacts({ alert, detection, camera }: AlertEmailInput): EmailFact[] {
  const [lon, lat] = camera.position;
  const facts: EmailFact[] = [
    {
      label: "Qué se vio",
      value: detection.regions.map((region) => `${FIRE_LABEL_NAME[region.label]} ${formatConfidence(region.confidence)}`).join(" · "),
    },
    { label: "Dónde", value: `${camera.name} (${num(lat, 4)}, ${num(lon, 4)})`, href: googleMapsUrl(camera.position) },
    { label: "Cuándo", value: `${formatCaliforniaTime(detection.capturedAt)}, hora de California` },
    {
      label: "Materiales cerca",
      value: detection.materials.length > 0 ? detection.materials.map(describeMaterial).join("; ") : "Ninguno detectado",
    },
    { label: "Foco en NASA FIRMS", value: describeFirms(alert) },
    {
      label: "Revisión del agente",
      value: `Confianza ${formatConfidence(alert.agent.confidence)}. ${alert.agent.reasons.join(". ")}.`,
    },
    { label: "Cámara", value: camera.attribution },
  ];

  if (alert.water.length > 0) {
    facts.push({
      label: "Agua cerca",
      value: alert.water
        .toSorted((a, b) => a.distanceM - b.distanceM)
        .slice(0, MAX_WATER_SOURCES)
        .map((source) => `${WATER_NAME[source.kind]}${source.name ? ` ${source.name}` : ""} a ${formatDistance(source.distanceM)}`)
        .join("; "),
    });
  }
  return facts;
}

/** "🔥 Posible incendio · Cámara de demo · confianza 87 %": usa la confianza más alta de la detección. */
export function buildSubject({ detection, camera }: AlertEmailInput): string {
  const top = Math.max(...detection.regions.map((region) => region.confidence));
  return `🔥 Posible incendio · ${camera.name} · confianza ${formatConfidence(top)}`;
}
