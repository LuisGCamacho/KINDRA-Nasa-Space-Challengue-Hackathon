import { notFound, parseIdParam, serverError } from "@/server/http";
import { getCamera } from "@/server/data";
import { getLatestDetection } from "@/server/cameras";

/** GET /api/cameras/{id}/detection → última detección (`Detection`), o `null` si el modelo no vio humo ni llama. */
export async function GET(_request: Request, ctx: RouteContext<"/api/cameras/[id]/detection">) {
  const param = parseIdParam((await ctx.params).id);
  if (!param.ok) return param.response;
  const cameraId = param.data;

  try {
    if (!(await getCamera(cameraId))) return notFound(`No existe la cámara ${cameraId}`);
    return Response.json(await getLatestDetection(cameraId));
  } catch (error) {
    return serverError(error);
  }
}
