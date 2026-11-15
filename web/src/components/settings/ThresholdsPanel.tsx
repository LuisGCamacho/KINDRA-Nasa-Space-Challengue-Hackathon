"use client";

import { useState } from "react";
import { num } from "@/lib/format";
import { useSettingsStore } from "@/store/useSettingsStore";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PillButton } from "@/components/ui/PillButton";

const inputClass = "glass h-9 w-full rounded-full px-4 text-[13px] tabular-nums";

/** Umbrales de "Alto" y "Muy alto". El límite inferior de Normal se deduce: 1 / umbral alto. */
export function ThresholdsPanel() {
  const { high, veryHigh, setThresholds, reset } = useSettingsStore();
  const [draftHigh, setDraftHigh] = useState(String(high));
  const [draftVeryHigh, setDraftVeryHigh] = useState(String(veryHigh));

  const nextHigh = Number(draftHigh.replace(",", "."));
  const nextVeryHigh = Number(draftVeryHigh.replace(",", "."));
  const valid = nextHigh > 1 && nextVeryHigh > nextHigh;

  function restore() {
    reset();
    setDraftHigh(String(useSettingsStore.getState().high));
    setDraftVeryHigh(String(useSettingsStore.getState().veryHigh));
  }

  return (
    <GlassPanel id="ajustes-umbrales" title="Umbrales de nivel" meta={`${num(high, 1)}× · ${num(veryHigh, 1)}×`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="umbral-alto">Alto desde</FieldLabel>
          <input id="umbral-alto" inputMode="decimal" value={draftHigh} onChange={(e) => setDraftHigh(e.target.value)} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="umbral-muy-alto">Muy alto desde</FieldLabel>
          <input id="umbral-muy-alto" inputMode="decimal" value={draftVeryHigh} onChange={(e) => setDraftVeryHigh(e.target.value)} className={inputClass} />
        </div>
      </div>
      <p className="mt-3 text-[12px] text-muted">
        {valid
          ? `Normal irá de ${num(1 / nextHigh, 2)}× a ${num(nextHigh, 1)}×; Bajo, por debajo de ${num(1 / nextHigh, 2)}×.`
          : "Alto tiene que ser mayor que 1 y Muy alto mayor que Alto."}
      </p>
      <div className="mt-4 flex gap-2">
        <PillButton variant="primary" disabled={!valid} onClick={() => setThresholds(nextHigh, nextVeryHigh)}>
          Guardar
        </PillButton>
        <PillButton onClick={restore}>Volver a 1,5× y 3×</PillButton>
      </div>
    </GlassPanel>
  );
}
