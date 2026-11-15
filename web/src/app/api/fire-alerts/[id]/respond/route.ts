import { randomUUID } from "node:crypto";
import { z } from "zod";
import { badRequest, errorResponse, notFound, parseIdParam, serverError } from "@/server/http";
import { recordResponse } from "@/server/alert-responses";

const bodySchema = z.object({
  action: z.enum(["confirmar", "falso_positivo"], { error: "action debe ser confirmar o falso_positivo" }),
  note: z.string().trim().max(500, { error: "La nota puede tener hasta 500 caracteres" }).nullable().default(null),
});

/**
 * POST /api/fire-alerts/{id}/respond ← botones de la pantalla Alertas. Cuerpo: `{ action, note }`.
 * Desde la app no hay token: cada respuesta recibe un id nuevo. En el hackathon la app no tiene
 * usuarios; en producción esta ruta pide sesión.
 * Responde `{ result: "registrada" }`; 404 si la alerta no existe; 409 si ya tiene respuesta.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/fire-alerts/[id]/respond">) {
  const param = parseIdParam((await ctx.params).id);
  if (!param.ok) return param.response;
  const alertId = param.data;

  const body: unknown = await request.json().catch(() => undefined);
  if (body === undefined) return badRequest("El cuerpo no es JSON válido");
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message);

  try {
    const result = await recordResponse(
      { alertId, action: parsed.data.action, tokenId: randomUUID(), via: "app", respondedAt: new Date().toISOString() },
      parsed.data.note || null,
    );
    if (result === "alerta_inexistente") return notFound(`No existe la alerta ${alertId}`);
    if (result !== "registrada") return errorResponse(409, "Alguien ya respondió esta alerta");
    return Response.json({ result });
  } catch (error) {
    return serverError(error);
  }
}
