import { notFound, parseIdParam, serverError } from "@/server/http";
import { getCamera } from "@/server/data";
import { getTrack } from "@/server/cameras";

/** GET /api/cameras/{id}/track → recuadros del video cuadro a cuadro (`TrackFrame[]`); lista vacía si no hay video. */
export async function GET(_request: Request, ctx: RouteContext<"/api/cameras/[id]/track">) {
  const param = parseIdParam((await ctx.params).id);
  if (!param.ok) return param.response;
  const cameraId = param.data;

  try {
    if (!(await getCamera(cameraId))) return notFound(`No existe la cámara ${cameraId}`);
    return Response.json(await getTrack(cameraId));
  } catch (error) {
    return serverError(error);
  }
}
