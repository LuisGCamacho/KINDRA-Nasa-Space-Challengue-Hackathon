import { z } from "zod";
import { errorResponse, parseQuery } from "@/server/http";
import { getWeatherNow } from "@/server/weather";

const querySchema = z.object({
  lat: z.coerce
    .number({ error: "lat debe ser un número" })
    .min(-90, { error: "lat va de -90 a 90" })
    .max(90, { error: "lat va de -90 a 90" }),
  lon: z.coerce
    .number({ error: "lon debe ser un número" })
    .min(-180, { error: "lon va de -180 a 180" })
    .max(180, { error: "lon va de -180 a 180" }),
});

/** GET /api/weather?lat=&lon= → tiempo actual en el punto (`WeatherNow`), de MET Norway, con caché de una hora. */
export async function GET(request: Request) {
  const query = parseQuery(request, querySchema);
  if (!query.ok) return query.response;

  try {
    // MET Norway pide no mandar más de 4 decimales.
    return Response.json(await getWeatherNow(query.data.lat.toFixed(4), query.data.lon.toFixed(4)));
  } catch (error) {
    console.error("[api/weather]", error);
    return errorResponse(502, "El servicio del tiempo (MET Norway) no respondió");
  }
}
