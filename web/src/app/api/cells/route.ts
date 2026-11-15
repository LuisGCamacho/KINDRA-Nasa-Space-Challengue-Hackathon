import { z } from "zod";
import { bboxSchema, notFound, parseQuery, serverError, yearMonthSchema } from "@/server/http";
import { getCells } from "@/server/data";
import { cellsInBbox } from "@/server/cells";

const querySchema = z.object({
  scope: z.enum(["ca", "world"], { error: "scope debe ser ca o world" }).default("ca"),
  month: yearMonthSchema,
  bbox: bboxSchema.optional(),
});

/**
 * GET /api/cells?scope=ca&month=YYYY-MM&bbox=oeste,sur,este,norte → celdas con fuego del mes (`CellsMonth`).
 * `scope` es `ca` (California, 0,1°) si no viene; `bbox` es opcional y recorta a la zona visible.
 * 404 si Python todavía no exportó ese mes.
 */
export async function GET(request: Request) {
  const query = parseQuery(request, querySchema);
  if (!query.ok) return query.response;
  const { scope, month, bbox } = query.data;

  try {
    const cellsMonth = await getCells(scope, month);
    if (!cellsMonth) return notFound(`No hay celdas de ${month} (${scope})`);
    return Response.json(bbox ? cellsInBbox(cellsMonth, bbox) : cellsMonth);
  } catch (error) {
    return serverError(error);
  }
}
