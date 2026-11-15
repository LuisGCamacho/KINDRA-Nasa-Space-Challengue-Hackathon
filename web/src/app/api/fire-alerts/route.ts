import { connection } from "next/server";
import { badRequest, errorResponse, serverError } from "@/server/http";
import { checkAgentRequest } from "@/server/agent-auth";
import { agentReportSchema, describeReportError } from "@/server/agent-report-schema";
import { getCamera } from "@/server/data";
import { listFireAlerts, saveNewFireAlert } from "@/server/fire-alerts";

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
 * Cuerpo: `AgentReport`. Responde `{ alert, email }`:
 * - 201 si la alerta es nueva;
 * - 200 si ya existía (el agente reintentó): devuelve la guardada sin cambiarla;
 * - 400 si el informe no cumple el contrato; 401 sin clave; 503 si la app no tiene `AGENT_SECRET`.
 * `email` es `null` hasta que exista el envío del correo (rama api/correo).
 */
export async function POST(request: Request) {
  const auth = checkAgentRequest(request);
  if (auth === "sin_configurar") return errorResponse(503, "La API no tiene AGENT_SECRET configurado");
  if (auth === "rechazada") return errorResponse(401, "Falta la clave del agente o no es válida");

  const body: unknown = await request.json().catch(() => undefined);
  if (body === undefined) return badRequest("El cuerpo no es JSON válido");
  const parsed = agentReportSchema.safeParse(body);
  if (!parsed.success) return badRequest(describeReportError(parsed.error));
  const { alert } = parsed.data;

  try {
    if (!(await getCamera(alert.cameraId))) return badRequest(`No existe la cámara ${alert.cameraId}`);

    const saved = await saveNewFireAlert(alert);
    return Response.json({ alert: saved.alert, email: null }, { status: saved.created ? 201 : 200 });
  } catch (error) {
    return serverError(error);
  }
}
