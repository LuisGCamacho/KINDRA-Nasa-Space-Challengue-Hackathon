import { z } from "zod";
import { compareFailureResponse, kindSchema, notFound, parseQuery, periodSchema, serverError, zoneIdSchema } from "@/server/http";
import { getSeries } from "@/server/data";
import { comparePeriod } from "@/server/stats";

/** `periodSchema` tiene validaciones entre campos: se combina con `and` en vez de extenderlo. */
const querySchema = periodSchema.and(z.object({ zone: zoneIdSchema, kind: kindSchema }));

/**
 * GET /api/stats?zone=&from=YYYY-MM&to=YYYY-MM&kind= → el período contra los mismos meses
 * de años anteriores (`Stats`). La app pide un solo mes: `from = to`. `kind` es `harm` si no viene.
 */
export async function GET(request: Request) {
  const query = parseQuery(request, querySchema);
  if (!query.ok) return query.response;
  const { zone, from, to, kind } = query.data;

  try {
    const series = await getSeries(zone);
    if (!series) return notFound(`No hay serie para la zona ${zone}`);

    const result = comparePeriod(series, { from, to }, kind);
    return result.ok ? Response.json(result.stats) : compareFailureResponse(result.reason, zone);
  } catch (error) {
    return serverError(error);
  }
}
