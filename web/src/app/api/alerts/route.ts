import { z } from "zod";
import { DEFAULT_HIGH, DEFAULT_VERY_HIGH } from "@/lib/levels";
import { parseQuery, serverError, yearMonthSchema } from "@/server/http";
import { getAllSeries } from "@/server/data";
import { zoneAlerts } from "@/server/zone-alerts";

/** `high` y `veryHigh` son opcionales: los umbrales de Ajustes. Sin ellos, los de `lib/levels.ts`. */
const querySchema = z
  .object({
    month: yearMonthSchema,
    high: z.coerce.number({ error: "high debe ser un número" }).gt(1, { error: "high debe ser mayor que 1" }).default(DEFAULT_HIGH),
    veryHigh: z.coerce.number({ error: "veryHigh debe ser un número" }).default(DEFAULT_VERY_HIGH),
  })
  .refine((q) => q.veryHigh > q.high, { error: "veryHigh debe ser mayor que high", path: ["veryHigh"] });

/**
 * GET /api/alerts?month=YYYY-MM&high=&veryHigh= → zonas en Alto o Muy alto ese mes (`Alert[]`),
 * del cociente más alto al más bajo, con el primer mes de la racha y el satélite de referencia.
 * Aplica la regla de 10 celdas-día. Lista vacía si ninguna zona está en alerta o no hay datos.
 */
export async function GET(request: Request) {
  const query = parseQuery(request, querySchema);
  if (!query.ok) return query.response;
  const { month, high, veryHigh } = query.data;

  try {
    return Response.json(zoneAlerts(await getAllSeries(), month, { high, veryHigh }));
  } catch (error) {
    return serverError(error);
  }
}
