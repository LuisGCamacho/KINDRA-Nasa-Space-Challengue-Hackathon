import { z } from "zod";
import { errorResponse, kindSchema, notFound, parseQuery, periodSchema, serverError, zoneIdSchema } from "@/server/http";
import { getSeries } from "@/server/data";
import { comparePeriod, type CompareFailure } from "@/server/stats";

/** `periodSchema` tiene validaciones entre campos: se combina con `and` en vez de extenderlo. */
const querySchema = periodSchema.and(z.object({ zone: zoneIdSchema, kind: kindSchema }));

/** Respuesta para cada motivo por el que no se pudo comparar. */
const FAILURE_RESPONSE: Record<CompareFailure, (zone: string) => Response> = {
  sin_periodo: (zone) => notFound(`La serie de ${zone} no llega a ese período`),
  sin_dato: (zone) => notFound(`La serie de ${zone} no tiene dato de esa columna en ese período`),
  sin_historial: (zone) => errorResponse(422, `No hay años anteriores de ${zone} para comparar`),
};

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
    return result.ok ? Response.json(result.stats) : FAILURE_RESPONSE[result.reason](zone);
  } catch (error) {
    return serverError(error);
  }
}
