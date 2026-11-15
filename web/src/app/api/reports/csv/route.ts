import { z } from "zod";
import { notFound, parseQuery, serverError, yearMonthSchema, zoneIdSchema } from "@/server/http";
import { getSeries } from "@/server/data";
import { buildSeriesCsv } from "@/server/csv";

/** `from` y `to` son opcionales, pero van juntos. Sin ellos se descarga la serie completa. */
const querySchema = z
  .object({ zone: zoneIdSchema, from: yearMonthSchema.optional(), to: yearMonthSchema.optional() })
  .refine((q) => (q.from === undefined) === (q.to === undefined), { error: "from y to van juntos" })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { error: "from no puede ser posterior a to" });

/**
 * GET /api/reports/csv?zone=&from=YYYY-MM&to=YYYY-MM → serie mensual de la zona en CSV para Excel
 * (BOM, `;` y coma decimal), con incertidumbre, satélite de referencia y versión del método.
 */
export async function GET(request: Request) {
  const query = parseQuery(request, querySchema);
  if (!query.ok) return query.response;
  const { zone, from, to } = query.data;

  try {
    const series = await getSeries(zone);
    if (!series) return notFound(`No hay serie para la zona ${zone}`);

    const range = from && to ? { from, to } : undefined;
    if (range && !series.months.some((row) => row.t >= range.from && row.t <= range.to)) {
      return notFound(`La serie de ${zone} no tiene meses entre ${range.from} y ${range.to}`);
    }

    const name = range ? `kindra-${zone}-${range.from}-a-${range.to}.csv` : `kindra-${zone}.csv`;
    return new Response(buildSeriesCsv(series, range), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
