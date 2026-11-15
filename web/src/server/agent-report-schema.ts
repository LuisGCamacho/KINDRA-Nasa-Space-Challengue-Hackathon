import { z } from "zod";
import type { AgentReport } from "@/lib/alert-types";
import { SLUG_ID } from "./http";

/*
  Lo que manda el agente de Python a `POST /api/fire-alerts`: el contrato `AgentReport`
  escrito en zod. Si Python cambia un campo, el POST responde 400 con el campo que falló
  y no se guarda nada. Las fechas van en ISO 8601 UTC terminadas en `Z` (`contracts.py`).
*/

const unit = z.number().min(0).max(1);
const id = z.string().regex(SLUG_ID, { error: "Los ids van en minúsculas con guiones" }).max(64);
const isoUtc = z.iso.datetime({ error: "Las fechas van en ISO 8601 UTC terminadas en Z" });
const lonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const box = z.object({ x: unit, y: unit, w: unit, h: unit });
const frameUrl = z.string().regex(/^\/live\/frames\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/, {
  error: "Las imágenes van en /live/frames/ con un nombre simple",
});

const fireRegion = z.object({
  label: z.enum(["humo", "llama", "anomalia"]),
  confidence: unit,
  box,
  trackId: z.number().int().nullable(),
});

const detection = z.object({
  id,
  cameraId: id,
  capturedAt: isoUtc,
  frameUrl,
  annotatedUrl: frameUrl,
  // Vacía solo en "revisar" (ver el refine de abajo): de noche el modelo no ve humo y queda el foco satelital.
  regions: z.array(fireRegion),
  materials: z.array(
    z.object({
      label: z.enum(["vegetacion", "auto", "edificio", "tanque_combustible"]),
      source: z.enum(["imagen", "osm"]),
      box: box.nullable(),
      distanceM: z.number().min(0).nullable(),
    }),
  ),
  model: z.object({ name: z.string().min(1), version: z.string().min(1) }),
});

const alert = z.object({
  id,
  detectionId: id,
  cameraId: id,
  createdAt: isoUtc,
  status: z.enum(["pendiente", "descartada"]),
  agent: z.object({
    decision: z.enum(["confirmar", "descartar", "revisar"]),
    confidence: unit,
    reasons: z.array(z.string().min(1).max(200)).min(1).max(5),
  }),
  firms: z.object({
    found: z.boolean(),
    nearestKm: z.number().min(0).nullable(),
    hoursAgo: z.number().min(0).nullable(),
    source: z.string().nullable(),
  }),
  water: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.enum(["hidrante", "rio", "lago", "represa"]),
      name: z.string().nullable(),
      position: lonLat,
      distanceM: z.number().min(0),
    }),
  ),
  emailedAt: z.null(),
});

const draft = z.object({ headline: z.string().min(1).max(140), summary: z.string().min(1).max(600) });

export const agentReportSchema = z
  .object({ alert, detection, draft: draft.nullable() })
  .refine((report) => report.alert.detectionId === report.detection.id, {
    error: "alert.detectionId no coincide con detection.id",
    path: ["alert", "detectionId"],
  })
  .refine((report) => report.alert.cameraId === report.detection.cameraId, {
    error: "alert.cameraId no coincide con detection.cameraId",
    path: ["alert", "cameraId"],
  })
  .refine((report) => report.detection.regions.length > 0 || report.alert.agent.decision === "revisar", {
    error: "una detección sin recuadros solo puede quedar para revisar",
    path: ["detection", "regions"],
  })
  .refine((report) => (report.alert.status === "descartada") === (report.alert.agent.decision === "descartar"), {
    error: "status es descartada solo si el agente decidió descartar",
    path: ["alert", "status"],
  }) satisfies z.ZodType<AgentReport>;

/** Primer error del informe con la ruta del campo, por ejemplo `alert.agent.confidence: …`. */
export function describeReportError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "El informe no cumple el contrato AgentReport";
  const where = issue.path.join(".");
  return where ? `${where}: ${issue.message}` : issue.message;
}
