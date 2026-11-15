"use client";

import { useRespondToAlert } from "@/hooks/useRespondToAlert";
import { PillButton } from "@/components/ui/PillButton";

/** Los mismos dos botones del correo, para responder desde la app. */
export function RespondButtons({ alertId }: { alertId: string }) {
  const respond = useRespondToAlert(alertId);

  return (
    <div className="inline-flex gap-2">
      <PillButton variant="primary" className="h-8" disabled={respond.isPending} onClick={() => respond.mutate("confirmar")}>
        Confirmar incendio
      </PillButton>
      <PillButton className="h-8" disabled={respond.isPending} onClick={() => respond.mutate("falso_positivo")}>
        Falso positivo
      </PillButton>
    </div>
  );
}
