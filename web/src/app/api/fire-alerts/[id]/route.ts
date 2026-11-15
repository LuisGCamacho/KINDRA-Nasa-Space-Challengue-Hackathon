import { notFound, parseIdParam, serverError } from "@/server/http";
import { getFireAlert } from "@/server/fire-alerts";

/** GET /api/fire-alerts/{id} → una alerta (`FireAlert`), o 404. */
export async function GET(_request: Request, ctx: RouteContext<"/api/fire-alerts/[id]">) {
  const param = parseIdParam((await ctx.params).id);
  if (!param.ok) return param.response;

  try {
    const alert = await getFireAlert(param.data);
    return alert ? Response.json(alert) : notFound(`No existe la alerta ${param.data}`);
  } catch (error) {
    return serverError(error);
  }
}
