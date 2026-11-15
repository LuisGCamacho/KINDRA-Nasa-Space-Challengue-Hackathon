import "server-only";
import type { AlertAction, AlertResponse, FireAlertStatus } from "@/lib/alert-types";
import { updateLive } from "./live-store";
import { getFireAlert, updateFireAlert } from "./fire-alerts";

const RESPONSES_FILE = "alert-responses.json";

/** El agente (`python -m kindra agent learn`) lee esta cola, escribe el `FalsePositiveLog` y la vacía. */
export const FALSE_POSITIVE_QUEUE = "false-positive-queue.json";

/** Respuesta guardada: la del contrato más la nota de la persona (la tabla `alert_responses` también la tiene). */
export type StoredResponse = AlertResponse & { note: string | null };

/** Caso en la cola de falsos positivos. */
export interface FalsePositiveQueueItem {
  alertId: string;
  note: string | null;
  respondedAt: string;
}

const STATUS_FOR_ACTION: Record<AlertAction, FireAlertStatus> = {
  confirmar: "incendio_confirmado",
  falso_positivo: "falso_positivo",
};

export type RecordResult = "registrada" | "token_usado" | "ya_respondida" | "alerta_inexistente";

/**
 * Guarda la respuesta de una persona y cambia el estado de la alerta.
 * Un token sirve una sola vez y una alerta se responde una sola vez.
 * Primero comprueba que la alerta exista: así no quedan respuestas huérfanas.
 */
export async function recordResponse(response: AlertResponse, note: string | null = null): Promise<RecordResult> {
  if (!(await getFireAlert(response.alertId))) return "alerta_inexistente";

  const saved = await updateLive<StoredResponse[], RecordResult>(RESPONSES_FILE, [], (responses) => {
    if (responses.some((item) => item.tokenId === response.tokenId)) return { next: responses, result: "token_usado" };
    if (responses.some((item) => item.alertId === response.alertId)) return { next: responses, result: "ya_respondida" };
    return { next: [...responses, { ...response, note }], result: "registrada" };
  });
  if (saved !== "registrada") return saved;

  await updateFireAlert(response.alertId, (alert) => ({ ...alert, status: STATUS_FOR_ACTION[response.action] }));

  if (response.action === "falso_positivo") {
    await updateLive<FalsePositiveQueueItem[], void>(FALSE_POSITIVE_QUEUE, [], (queue) => ({
      next: [...queue, { alertId: response.alertId, note, respondedAt: response.respondedAt }],
      result: undefined,
    }));
  }
  return "registrada";
}
