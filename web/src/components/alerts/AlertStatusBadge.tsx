import type { FireAlertStatus } from "@/lib/alert-types";
import { LEVEL_COLOR, NO_DATA_COLOR } from "@/lib/colors";

/** Palabra y color de cada estado. El rojo queda para el incendio confirmado. */
const STATUS: Record<FireAlertStatus, { text: string; color: string }> = {
  pendiente: { text: "Pendiente", color: NO_DATA_COLOR },
  descartada: { text: "Descartada", color: NO_DATA_COLOR },
  enviada: { text: "Esperando respuesta", color: LEVEL_COLOR.Alto },
  incendio_confirmado: { text: "Incendio confirmado", color: LEVEL_COLOR["Muy alto"] },
  falso_positivo: { text: "Falso positivo", color: NO_DATA_COLOR },
};

export function AlertStatusBadge({ status }: { status: FireAlertStatus }) {
  const { text, color } = STATUS[status];
  return (
    <span className="glass inline-flex h-6 items-center gap-2 whitespace-nowrap rounded-full px-2.5 text-[11.5px]">
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {text}
    </span>
  );
}
