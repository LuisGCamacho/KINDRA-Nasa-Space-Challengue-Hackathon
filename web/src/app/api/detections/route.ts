import { connection } from "next/server";
import { serverError } from "@/server/http";
import { getLatestDetections } from "@/server/cameras";

/**
 * GET /api/detections → la última detección de cada cámara que tiene una (`Detection[]`).
 * Las cámaras sin humo ni llama no aparecen. La cuadrícula de cámaras usa esta ruta en vez de
 * pedir `/api/cameras/{id}/detection` una vez por cámara.
 */
export async function GET() {
  // Sin esto, con `cacheComponents` la respuesta se calcula una sola vez, en el build.
  await connection();
  try {
    return Response.json(await getLatestDetections());
  } catch (error) {
    return serverError(error);
  }
}
