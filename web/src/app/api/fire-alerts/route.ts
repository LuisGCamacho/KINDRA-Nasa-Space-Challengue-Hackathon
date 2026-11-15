import { connection } from "next/server";
import { badRequest, errorResponse, serverError } from "@/server/http";
import { checkAgentRequest } from "@/server/agent-auth";
import { agentReportSchema, describeReportError } from "@/server/agent-report-schema";
import { getCamera } from "@/server/data";
import { getFireAlert, listFireAlerts, saveNewFireAlert } from "@/server/fire-alerts";
import { sendAlertEmailOnce } from "@/server/email/send-alert-email";

/** GET /api/fire-alerts → todas las alertas de cámara (`FireAlert[]`), de la más nueva a la más vieja. */
export async function GET() {
  // Sin esto, con `cacheComponents` la respuesta se calcula una sola vez, en el build.
  await connection();
  try {
    return Response.json(await listFireAlerts());
  } catch (error) {
    return serverError(error);
  }
}

/**
 * POST /api/fire-alerts ← el agente de Python, con `Authorization: Bearer <AGENT_SECRET>`.
 * Cuerpo: `AgentReport`. Guarda la alerta y, si el agente la confirmó, manda el único correo.
 * Responde `{ alert, email, emailError }`:
 * - 201 si la alerta es nueva; 200 si ya existía (el agente reintentó): no se cambia, y si
 *   su correo había fallado se vuelve a intentar;
 * - `email` es el registro del correo, o `null` si no se mandó (no confirmada, ya enviada o falló);
 * - `emailError` explica por qué falló el envío (la alerta igual quedó guardada);
 * - 400 si el informe no cumple el contrato; 401 sin clave; 503 si la app no tiene `AGENT_SECRET`.
 */
export async function POST(request: Request) {
  const auth = checkAgentRequest(request);
  if (auth === "sin_configurar") return errorResponse(503, "La API no tiene AGENT_SECRET configurado");
  if (auth === "rechazada") return errorResponse(401, "Falta la clave del agente o no es válida");

  const body: unknown = await request.json().catch(() => undefined);
  if (body === undefined) return badRequest("El cuerpo no es JSON válido");
  const parsed = agentReportSchema.safeParse(body);
  if (!parsed.success) return badRequest(describeReportError(parsed.error));
  const { alert, detection, draft } = parsed.data;

  try {
    const camera = await getCamera(alert.cameraId);
    if (!camera) return badRequest(`No existe la cámara ${alert.cameraId}`);

    const saved = await saveNewFireAlert(alert);
    const status = saved.created ? 201 : 200;
    const confirmed = alert.agent.decision === "confirmar" && draft !== null;
    if (!confirmed) return Response.json({ alert: saved.alert, email: null, emailError: null }, { status });

    try {
      const email = await sendAlertEmailOnce({ alert: saved.alert, detection, camera }, draft);
      const current = (await getFireAlert(alert.id)) ?? saved.alert;
      return Response.json({ alert: current, email, emailError: null }, { status });
    } catch (error) {
      console.error("[api/fire-alerts] correo", error);
      const emailError = error instanceof Error ? error.message : "No se pudo mandar el correo";
      return Response.json({ alert: saved.alert, email: null, emailError }, { status });
    }
  } catch (error) {
    return serverError(error);
  }
}
