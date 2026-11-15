"use client";

import { useLensStore, type SeriesMode } from "@/store/useLensStore";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Segmented, type SegmentOption } from "@/components/ui/Segmented";
import { StatRow } from "@/components/ui/StatRow";
import { ThresholdsPanel } from "./ThresholdsPanel";

const SERIES_OPTIONS: SegmentOption<SeriesMode>[] = [
  { value: "harm", label: "Armonizada" },
  { value: "raw", label: "Cruda" },
];

/** Ajustes: serie, umbrales y lo que todavía no se puede cambiar desde la app. */
export function SettingsScreen() {
  const series = useLensStore((state) => state.series);
  const setSeries = useLensStore((state) => state.setSeries);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 py-6">
      <ScreenHeader title="Ajustes" lead="Se guardan en este navegador. No cambian los datos, solo cómo se leen." />

      <GlassPanel id="ajustes-serie" title="Serie" meta={series === "harm" ? "Armonizada" : "Cruda"}>
        <Segmented label="Serie que usa la lupa" value={series} options={SERIES_OPTIONS} onChange={setSeries} fill />
        <p className="mt-3 text-[12px] text-muted">La cruda suma MODIS y VIIRS sin ajustar: sirve para ver el salto de 2012.</p>
      </GlassPanel>

      <ThresholdsPanel />

      <GlassPanel id="ajustes-pendientes" title="Más ajustes" meta="pendiente" defaultOpen={false}>
        <dl>
          <StatRow label="Confianza mínima de los focos" value="pendiente" hint="se fija en Python" />
          <StatRow label="Unidades" value="celdas-día" />
          <StatRow label="Correo de alertas" value="pendiente" hint="se configura en .env" />
        </dl>
      </GlassPanel>
    </section>
  );
}
