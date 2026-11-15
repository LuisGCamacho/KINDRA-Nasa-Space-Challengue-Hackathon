import { notFound, parseIdParam, serverError } from "@/server/http";
import { getFireAlert } from "@/server/fire-alerts";

/**
 * GET /api/fire-alerts/{id}/water → fuentes de agua de la alerta (`WaterSource[]`), de la más cercana
 * a la más lejana. Las calcula el agente en Python (Overpass) una vez: la app no consulta OpenStreetMap.
 * Lista vacía si el incendio no es grande.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/fire-alerts/[id]/water">) {
  const param = parseIdParam((await ctx.params).id);
  if (!param.ok) return param.response;

  try {
    const alert = await getFireAlert(param.data);
    if (!alert) return notFound(`No existe la alerta ${param.data}`);
    return Response.json(alert.water.toSorted((a, b) => a.distanceM - b.distanceM));
  } catch (error) {
    return serverError(error);
  }
}
