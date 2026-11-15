import { connection } from "next/server";
import { notFound, serverError } from "@/server/http";
import { getForecast } from "@/server/data";

/**
 * GET /api/forecast → último pronóstico de las próximas 24 h (`Forecast`), con las zonas
 * de mayor a menor probabilidad. 404 si Machine learning todavía no lo generó.
 */
export async function GET() {
  // Sin esto, con `cacheComponents` la respuesta se calcula una sola vez, en el build.
  await connection();
  try {
    const forecast = await getForecast();
    if (!forecast) return notFound("Todavía no hay pronóstico de las próximas 24 h");
    return Response.json({ ...forecast, zones: forecast.zones.toSorted((a, b) => b.p - a.p) });
  } catch (error) {
    return serverError(error);
  }
}
