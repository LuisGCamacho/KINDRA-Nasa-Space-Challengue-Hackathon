"use client";

import { ArrowLeft } from "lucide-react";
import { useLensStore } from "@/store/useLensStore";
import { PillButton } from "@/components/ui/PillButton";

/** Vuelve al estado anterior de la lupa (zona, mes, serie y lente). */
export function ReturnButton() {
  const canGoBack = useLensStore((state) => state.history.length > 0);
  const goBack = useLensStore((state) => state.goBack);

  return (
    <PillButton
      onClick={goBack}
      disabled={!canGoBack}
      title={canGoBack ? "Volver al estado anterior" : "Sin historial previo"}
      className="h-9 pl-3"
    >
      <ArrowLeft aria-hidden className="size-3.5" />
      Return
    </PillButton>
  );
}
