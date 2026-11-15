import "server-only";
import type { FireAlert } from "@/lib/alert-types";
import { createActionToken } from "../tokens";

export interface ResponseLinks {
  alertUrl: string;
  confirmUrl: string;
  falsePositiveUrl: string;
}

function appUrl(): string {
  const value = process.env.APP_URL;
  if (!value) throw new Error("Falta APP_URL, por ejemplo http://localhost:3000");
  return value.replace(/\/$/, "");
}

/**
 * Enlaces del correo. Los botones no responden solos: abren `/responder`, que pide
 * confirmar con un clic. Así los antivirus del correo, que abren los enlaces para
 * revisarlos, no pueden marcar una alerta por accidente.
 */
export function buildResponseLinks(alert: FireAlert): ResponseLinks {
  const base = appUrl();
  const respond = (action: "confirmar" | "falso_positivo") =>
    `${base}/responder?token=${encodeURIComponent(createActionToken(alert.id, action, alert.createdAt))}`;

  return {
    alertUrl: `${base}/alertas?alerta=${encodeURIComponent(alert.id)}`,
    confirmUrl: respond("confirmar"),
    falsePositiveUrl: respond("falso_positivo"),
  };
}
