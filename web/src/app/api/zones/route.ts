import { connection } from "next/server";
import { serverError } from "@/server/http";
import { getZones } from "@/server/data";

/** GET /api/zones → todas las zonas consultables (`Zone[]`); lista vacía si todavía no hay `zones.json`. */
export async function GET() {
  // Sin esto, con `cacheComponents` la lista se congela en el build y no ve un `zones.json` nuevo.
  await connection();
  try {
    return Response.json(await getZones());
  } catch (error) {
    return serverError(error);
  }
}
