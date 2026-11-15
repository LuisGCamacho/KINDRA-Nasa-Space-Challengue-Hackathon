"use client";

import { useFactors, useSeries, useZone } from "@/hooks/queries";
import { yearlyTotals } from "@/lib/yearly";
import { useLensStore } from "@/store/useLensStore";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ScreenHeader, StatusText } from "@/components/ui/ScreenHeader";
import { FactorsTable } from "./FactorsTable";
import { MethodSteps } from "./MethodSteps";
import { ValidationPanel } from "./ValidationPanel";
import { YearlyChart } from "./YearlyChart";

/** Armonización: el método en tres pasos, la serie antes y después del ajuste y los factores. */
export function HarmonizationScreen() {
  const zoneId = useLensStore((state) => state.zoneId);
  const zone = useZone(zoneId);
  const { data: series } = useSeries(zoneId);
  const { data: factors, error: factorsError } = useFactors();

  const totals = series ? yearlyTotals(series.months) : [];
  const argentina = factors?.factors.filter((f) => f.region === "ar" && f.sat === "SNPP") ?? [];

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 py-6">
      <ScreenHeader
        title="Armonización"
        lead="Cómo se unen 25 años de MODIS y VIIRS en una sola serie, y la prueba de que funciona."
      />
      <MethodSteps />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <GlassPanel id="armonizacion-anual" title="Focos por año" meta={zone?.name ?? zoneId}>
          {totals.length > 1 ? <YearlyChart totals={totals} /> : <StatusText>Serie anual pendiente.</StatusText>}
        </GlassPanel>
        <ValidationPanel />
      </div>

      <div>
        <h2 className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">
          Factor VIIRS → MODIS · Argentina · calibrado en {factors?.calibration ?? "2012–2021"}
        </h2>
        {argentina.length > 0 ? (
          <FactorsTable factors={argentina} />
        ) : (
          <StatusText>Factores pendientes{factorsError ? `: ${factorsError.message}` : "."}</StatusText>
        )}
      </div>
    </section>
  );
}
