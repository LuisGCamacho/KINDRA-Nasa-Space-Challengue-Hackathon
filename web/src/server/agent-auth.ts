import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Resultado de revisar la clave del agente:
 * - `ok`: el pedido trae `Authorization: Bearer <AGENT_SECRET>`.
 * - `sin_configurar`: la app no tiene `AGENT_SECRET` (falta en `.env.local`).
 * - `rechazada`: falta la clave o no coincide.
 */
export type AgentAuth = "ok" | "sin_configurar" | "rechazada";

/** El agente de Python se identifica con `Authorization: Bearer <AGENT_SECRET>`. */
export function checkAgentRequest(request: Request): AgentAuth {
  const secret = process.env.AGENT_SECRET;
  if (!secret) return "sin_configurar";

  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return "rechazada";

  const expected = Buffer.from(secret);
  const received = Buffer.from(header.slice("Bearer ".length));
  return expected.length === received.length && timingSafeEqual(expected, received) ? "ok" : "rechazada";
}
