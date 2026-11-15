"use client";

import { FireAlertNotice } from "@/components/alerts/FireAlertNotice";
import { LeftPanels } from "./LeftPanels";
import { LensStage } from "./LensStage";
import { RightPanels } from "./RightPanels";

/**
 * Pantalla de la lupa en tres columnas: controles a la izquierda, la lente al centro
 * y la respuesta a la derecha. En celular la lente va primero y los paneles debajo. Si hay un
 * incendio confirmado, el aviso flota abajo a la derecha, sin tapar la lente.
 */
export function LensScreen() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:h-[calc(100dvh-84px)] xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      <aside className="order-2 space-y-3 no-scrollbar xl:order-1 xl:overflow-y-auto xl:py-1">
        <LeftPanels />
      </aside>
      <section className="order-1 min-h-0 pt-2 xl:order-2 xl:pt-0">
        <LensStage />
      </section>
      <aside className="order-3 space-y-3 no-scrollbar xl:overflow-y-auto xl:py-1">
        <RightPanels />
      </aside>
      <FireAlertNotice />
    </div>
  );
}
