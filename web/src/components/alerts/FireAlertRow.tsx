import type { FireAlert } from "@/lib/alert-types";
import { formatConfidence } from "@/lib/detection-text";
import { formatLocalTime } from "@/lib/time";
import { num } from "@/lib/format";
import { AlertStatusBadge } from "./AlertStatusBadge";
import { RespondButtons } from "./RespondButtons";

const DECISION_TEXT: Record<FireAlert["agent"]["decision"], string> = {
  confirmar: "Confirmó",
  descartar: "Descartó",
  revisar: "Pide revisar",
};

function firmsText({ firms }: FireAlert): string {
  if (!firms.found) return "Sin foco";
  return firms.nearestKm === null ? "Foco cerca" : `Foco a ${num(firms.nearestKm, 1)} km`;
}

/** Una alerta en la tabla. Los botones aparecen solo mientras la alerta espera respuesta. */
export function FireAlertRow({ alert }: { alert: FireAlert }) {
  return (
    <tr className="border-b border-line-soft last:border-b-0">
      <td className="py-3 pr-4 tabular-nums">{formatLocalTime(alert.createdAt)}</td>
      <td className="py-3 pr-4">{alert.cameraId}</td>
      <td className="py-3 pr-4 tabular-nums">
        {DECISION_TEXT[alert.agent.decision]} · {formatConfidence(alert.agent.confidence)}
      </td>
      <td className="py-3 pr-4">{firmsText(alert)}</td>
      <td className="py-3 pr-4">
        <AlertStatusBadge status={alert.status} />
      </td>
      <td className="py-3 text-right">{alert.status === "enviada" && <RespondButtons alertId={alert.id} />}</td>
    </tr>
  );
}
