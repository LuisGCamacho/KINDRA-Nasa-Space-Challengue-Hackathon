import { connection } from "next/server";
import { notFound, serverError } from "@/server/http";
import { getFactors } from "@/server/data";

/**
 * GET /api/factors → factores de armonización VIIRS → MODIS (`HarmonizationFactors`):
 * el k de cada región, satélite y mes, con su intervalo. 404 si Python todavía no los exportó.
 */
export async function GET() {
  // Sin esto, con `cacheComponents` la respuesta se calcula una sola vez, en el build.
  await connection();
  try {
    const factors = await getFactors();
    return factors ? Response.json(factors) : notFound("Todavía no hay factores de armonización");
  } catch (error) {
    return serverError(error);
  }
}
