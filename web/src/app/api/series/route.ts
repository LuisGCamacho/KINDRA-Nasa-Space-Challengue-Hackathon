import { z } from "zod";
import { notFound, parseQuery, serverError, zoneIdSchema } from "@/server/http";
import { getSeries } from "@/server/data";

const querySchema = z.object({ zone: zoneIdSchema });

/** GET /api/series?zone= → serie mensual completa de la zona (`Series`), o 404 si no existe. */
export async function GET(request: Request) {
  const query = parseQuery(request, querySchema);
  if (!query.ok) return query.response;
  const { zone } = query.data;

  try {
    const series = await getSeries(zone);
    return series ? Response.json(series) : notFound(`No hay serie para la zona ${zone}`);
  } catch (error) {
    return serverError(error);
  }
}
