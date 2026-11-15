import { connection } from "next/server";
import { serverError } from "@/server/http";
import { getCameras } from "@/server/data";

/** GET /api/cameras → cámaras públicas que usa KINDRA (`Camera[]`), con su crédito y condiciones. */
export async function GET() {
  // Sin esto, con `cacheComponents` la respuesta se calcula una sola vez, en el build.
  await connection();
  try {
    return Response.json(await getCameras());
  } catch (error) {
    return serverError(error);
  }
}
