import { z } from "zod";
import { compareFailureResponse, kindSchema, notFound, parseQuery, periodSchema, serverError, zoneIdSchema } from "@/server/http";
import { getSeries, getZone } from "@/server/data";
import { comparePeriod } from "@/server/stats";
import { buildBulletin } from "@/server/bulletin";

/** `month=YYYY-MM` es un atajo de `from = to = month`: la app pide un solo mes. */
const querySchema = z.preprocess(
  (params) => {
    const { month, ...rest } = params as Record<string, string>;
    return month && !rest.from && !rest.to ? { ...rest, from: month, to: month } : rest;
  },
  periodSchema.and(z.object({ zone: zoneIdSchema, kind: kindSchema })),
);

/**
 * GET /api/reports/bulletin?zone=&month=YYYY-MM (o `from=&to=`)&kind= → boletín en texto del período
 * (`Bulletin`), con las mismas cifras que `/api/stats` y el reconocimiento de NASA FIRMS.
 */
export async function GET(request: Request) {
  const query = parseQuery(request, querySchema);
  if (!query.ok) return query.response;
  const { zone, from, to, kind } = query.data;

  try {
    const [zoneInfo, series] = await Promise.all([getZone(zone), getSeries(zone)]);
    if (!zoneInfo || !series) return notFound(`No existe la zona ${zone}`);

    const period = { from, to };
    const result = comparePeriod(series, period, kind);
    if (!result.ok) return compareFailureResponse(result.reason, zone);

    const partial = series.months.some((row) => row.t >= from && row.t <= to && row.partial);
    return Response.json(buildBulletin({ zoneName: zoneInfo.name, period, kind, stats: result.stats, partial }));
  } catch (error) {
    return serverError(error);
  }
}
