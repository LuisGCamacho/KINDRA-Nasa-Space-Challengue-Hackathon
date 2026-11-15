import "server-only";
import { Resend } from "resend";
import type { AlertEmailDraft, AlertEmailRecord } from "@/lib/alert-types";
import { getFireAlert, updateFireAlert } from "../fire-alerts";
import { buildEmailFacts, buildSubject, type AlertEmailInput } from "./facts";
import { buildResponseLinks } from "./links";
import { ANNOTATED_CID, renderAlertEmailHtml } from "./alert-email-html";
import { renderAlertEmailText } from "./alert-email-text";
import { buildImageAttachments } from "./images";

/** Configuración del envío, toda de `.env.local`: la dirección nunca va en el código. */
function emailConfig(): { apiKey: string; from: string; to: string } {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM;
  const to = process.env.ALERT_EMAIL_TO;
  if (!apiKey) throw new Error("Falta RESEND_API_KEY");
  if (!from) throw new Error("Falta ALERT_EMAIL_FROM, por ejemplo KINDRA <alertas@tu-dominio>");
  // Un solo destinatario: el integrante que aceptó por escrito recibir los correos de prueba.
  if (!to || to.includes(",") || to.includes(";")) throw new Error("ALERT_EMAIL_TO debe tener una sola dirección");
  return { apiKey, from, to };
}

/**
 * Manda el correo de una alerta una sola vez. Mira la alerta guardada, no la que llegó en el
 * pedido: si ya tiene `emailedAt` o ya la respondió una persona, no hace nada y devuelve `null`.
 * La clave de idempotencia (`alerta-{id}`) evita que Resend lo repita si el pedido se reintenta.
 * Si Resend falla, lanza el error y la alerta queda sin `emailedAt`, lista para reintentar.
 */
export async function sendAlertEmailOnce(input: AlertEmailInput, draft: AlertEmailDraft): Promise<AlertEmailRecord | null> {
  const stored = await getFireAlert(input.alert.id);
  if (!stored || stored.emailedAt || stored.status !== "pendiente") return null;

  const { apiKey, from, to } = emailConfig();
  const subject = buildSubject(input);
  const attachments = await buildImageAttachments(input.detection);
  const content = {
    subject,
    draft,
    facts: buildEmailFacts({ ...input, alert: stored }),
    links: buildResponseLinks(stored),
    hasImage: attachments.some((attachment) => attachment.contentId === ANNOTATED_CID),
  };

  const { data, error } = await new Resend(apiKey).emails.send(
    { from, to, subject, html: renderAlertEmailHtml(content), text: renderAlertEmailText(content), attachments },
    { idempotencyKey: `alerta-${stored.id}` },
  );
  if (error || !data) throw new Error(`Resend no envió el correo: ${error?.message ?? "sin respuesta"}`);

  const sentAt = new Date().toISOString();
  await updateFireAlert(stored.id, (alert) => ({ ...alert, status: "enviada", emailedAt: sentAt }));
  return { alertId: stored.id, subject, providerId: data.id, sentAt };
}
