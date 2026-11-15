import { connection } from "next/server";
import { notFound, serverError } from "@/server/http";
import { getValidation } from "@/server/data";

/**
 * GET /api/validation → métricas de la validación de la armonización (`Validation`).
 * Un `value` en `null` es una métrica pendiente: la pantalla escribe "pendiente", nunca un número.
 * 404 si Machine learning todavía no exportó `validation.json`.
 */
export async function GET() {
  // Sin esto, con `cacheComponents` la respuesta se calcula una sola vez, en el build.
  await connection();
  try {
    const validation = await getValidation();
    return validation ? Response.json(validation) : notFound("Todavía no hay validación de la armonización");
  } catch (error) {
    return serverError(error);
  }
}
