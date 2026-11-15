import type { AlertEmailContent } from "./alert-email-html";

/** Versión en texto plano: la leen los clientes sin HTML y ayuda a no caer en spam. */
export function renderAlertEmailText({ draft, facts, links, hasImage }: AlertEmailContent): string {
  const factLines = facts.map(({ label, value, href }) => `${label}: ${value}${href ? `\n  ${href}` : ""}`);
  return [
    "POSIBLE INCENDIO",
    draft.headline,
    "",
    draft.summary,
    "",
    ...factLines,
    "",
    `Confirmar incendio: ${links.confirmUrl}`,
    `Marcar como falso positivo: ${links.falsePositiveUrl}`,
    `Ver la alerta en KINDRA: ${links.alertUrl}`,
    "",
    "Correo de prueba del equipo KINDRA. No es un aviso oficial.",
    `Los enlaces sirven una sola vez y vencen 72 horas después de la alerta.${hasImage ? " La imagen marcada va adjunta." : ""}`,
  ].join("\n");
}
