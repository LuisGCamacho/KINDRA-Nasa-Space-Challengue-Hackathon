"use server";

import { readActionToken } from "@/server/tokens";
import { recordResponse, type RecordResult } from "@/server/alert-responses";

export interface RespondState {
  result: RecordResult | "token_invalido" | null;
}

/** Acción del formulario de `/responder`: vuelve a revisar el token y guarda la respuesta una sola vez. */
export async function respondFromEmail(_previous: RespondState, form: FormData): Promise<RespondState> {
  const payload = readActionToken(String(form.get("token") ?? ""));
  if (!payload) return { result: "token_invalido" };

  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  const result = await recordResponse(
    { alertId: payload.alertId, action: payload.action, tokenId: payload.jti, via: "correo", respondedAt: new Date().toISOString() },
    note,
  );
  return { result };
}
