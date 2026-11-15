import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AlertAction } from "@/lib/alert-types";

/** Lo que va firmado dentro del enlace de cada botón del correo. */
export interface ActionTokenPayload {
  alertId: string;
  action: AlertAction;
  /** Id del token: se guarda al usarlo y no sirve una segunda vez. */
  jti: string;
  /** Vencimiento en segundos Unix. */
  exp: number;
}

/** Los botones sirven 72 horas desde que se creó la alerta; después se responde desde la app. */
export const TOKEN_TTL_SECONDS = 72 * 60 * 60;

const payloadSchema = z.object({
  alertId: z.string().min(1),
  action: z.enum(["confirmar", "falso_positivo"]),
  jti: z.string().min(1),
  exp: z.number().int(),
});

function secret(): Buffer {
  const value = process.env.ALERT_TOKEN_SECRET;
  if (!value || value.length < 32) throw new Error("ALERT_TOKEN_SECRET falta o tiene menos de 32 caracteres");
  return Buffer.from(value, "utf-8");
}

function sign(text: string): string {
  return createHmac("sha256", secret()).update(text).digest("base64url");
}

/**
 * Token `cuerpo.firma`: el cuerpo es el JSON en base64url y la firma, HMAC-SHA256.
 *
 * Es siempre el mismo para la misma alerta y la misma acción (el id sale de una firma y el
 * vencimiento, de la hora de la alerta). Así el correo de un reintento es idéntico al primero
 * y la clave de idempotencia de Resend lo reconoce como el mismo envío.
 *
 * @param alertCreatedAt - `FireAlert.createdAt`: los botones vencen 72 h después.
 */
export function createActionToken(alertId: string, action: AlertAction, alertCreatedAt: string): string {
  const payload: ActionTokenPayload = {
    alertId,
    action,
    jti: sign(`jti:${alertId}:${action}`).slice(0, 22),
    exp: Math.floor(Date.parse(alertCreatedAt) / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Comprueba la forma, la firma y el vencimiento. Devuelve el contenido, o `null` si el token
 * no sirve; nunca lanza por un token mal armado. No lo marca como usado: eso pasa al
 * registrar la respuesta.
 */
export function readActionToken(token: string, now = Date.now()): ActionTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  const parsed = payloadSchema.safeParse(decoded);
  if (!parsed.success) return null;
  return parsed.data.exp * 1000 > now ? parsed.data : null;
}
