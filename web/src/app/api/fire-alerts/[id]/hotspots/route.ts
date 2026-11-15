import { notFound, parseIdParam, serverError } from "@/server/http";
import { getAlertHotspots, getFireAlert } from "@/server/fire-alerts";

/**
 * GET /api/fire-alerts/{id}/hotspots → focos VIIRS y MODIS de la alerta (`FirmsHotspot[]`), del más
 * cercano a la cámara al más lejano. Los guarda el agente en Python al mandar la alerta; la app no
 * consulta FIRMS. Lista vacía si la alerta es anterior a esta ruta.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/fire-alerts/[id]/hotspots">) {
  const param = parseIdParam((await ctx.params).id);
  if (!param.ok) return param.response;

  try {
    if (!(await getFireAlert(param.data))) return notFound(`No existe la alerta ${param.data}`);
    return Response.json(await getAlertHotspots(param.data));
  } catch (error) {
    return serverError(error);
  }
}
