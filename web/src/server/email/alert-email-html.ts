import type { AlertEmailDraft } from "@/lib/alert-types";
import type { EmailFact } from "./facts";
import type { ResponseLinks } from "./links";
import { escapeHtml } from "./escape";

/**
 * Paleta clara del Manual para el correo. Va clara aunque la app sea oscura:
 * muchos clientes de correo invierten o rompen los fondos oscuros.
 */
const C = {
  slate: "#1B2835", // texto y botón principal
  muted: "#5B6672",
  border: "#E5E4E2",
  stage: "#EFEEEA",
  fire: "#D7262B", // solo para el fuego
  white: "#FFFFFF",
} as const;

/** Content-ID de la imagen marcada; el HTML la pide con `cid:`. */
export const ANNOTATED_CID = "deteccion-marcada";

const FONT = "font-family:Arial,Helvetica,sans-serif;";

export interface AlertEmailContent {
  subject: string;
  draft: AlertEmailDraft;
  facts: EmailFact[];
  links: ResponseLinks;
  /** `false` si no se encontró la imagen marcada: el correo sale igual, sin foto. */
  hasImage: boolean;
}

function factRow({ label, value, href }: EmailFact): string {
  const text = escapeHtml(value);
  const cell = href ? `<a href="${escapeHtml(href)}" style="color:${C.slate};">${text}</a>` : text;
  return `
    <tr>
      <td style="${FONT}padding:10px 0;border-top:1px solid ${C.border};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};width:150px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="${FONT}padding:10px 0;border-top:1px solid ${C.border};font-size:14px;color:${C.slate};">${cell}</td>
    </tr>`;
}

function button(label: string, href: string, primary: boolean): string {
  const colors = primary
    ? `background:${C.slate};color:${C.white};border:1px solid ${C.slate};`
    : `background:${C.white};color:${C.slate};border:1px solid ${C.border};`;
  return `<a href="${escapeHtml(href)}" style="${FONT}${colors}display:inline-block;padding:11px 18px;border-radius:6px;font-size:14px;font-weight:bold;text-decoration:none;">${escapeHtml(label)}</a>`;
}

function imageRow(hasImage: boolean): string {
  if (!hasImage) {
    return `<tr><td style="${FONT}padding:16px 24px;background:${C.stage};font-size:13px;color:${C.muted};">La imagen de la cámara no estaba disponible al enviar el correo.</td></tr>`;
  }
  return `<tr><td style="padding:0;"><img src="cid:${ANNOTATED_CID}" width="600" alt="Imagen de la cámara con la zona de humo o llama marcada" style="display:block;width:100%;height:auto;"></td></tr>`;
}

/** Correo HTML con tablas y estilos en línea: es lo único que respetan todos los clientes de correo. */
export function renderAlertEmailHtml({ subject, draft, facts, links, hasImage }: AlertEmailContent): string {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.stage};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.stage};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.white};border:1px solid ${C.border};border-radius:6px;">
        <tr><td style="padding:20px 24px;border-bottom:3px solid ${C.fire};">
          <span style="${FONT}font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.fire};font-weight:bold;">Posible incendio</span>
          <h1 style="${FONT}margin:6px 0 0;font-size:20px;line-height:1.3;color:${C.slate};">${escapeHtml(draft.headline)}</h1>
        </td></tr>
        ${imageRow(hasImage)}
        <tr><td style="${FONT}padding:20px 24px 8px;font-size:14px;line-height:1.55;color:${C.slate};">${escapeHtml(draft.summary)}</td></tr>
        <tr><td style="padding:0 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${facts.map(factRow).join("")}</table>
        </td></tr>
        <tr><td style="padding:20px 24px;">
          ${button("Confirmar incendio", links.confirmUrl, true)}
          &nbsp;
          ${button("Marcar como falso positivo", links.falsePositiveUrl, false)}
        </td></tr>
        <tr><td style="${FONT}padding:0 24px 20px;font-size:13px;"><a href="${escapeHtml(links.alertUrl)}" style="color:${C.slate};">Ver la alerta en KINDRA</a></td></tr>
        <tr><td style="${FONT}padding:14px 24px;border-top:1px solid ${C.border};font-size:11px;line-height:1.5;color:${C.muted};">
          Correo de prueba del equipo KINDRA (NASA Space Apps 2026). No es un aviso oficial ni reemplaza a los servicios de emergencia.
          Los botones sirven una sola vez y vencen 72 horas después de la alerta.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
