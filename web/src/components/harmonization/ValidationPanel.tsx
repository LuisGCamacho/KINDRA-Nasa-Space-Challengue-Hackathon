"use client";

import { useValidation } from "@/hooks/queries";
import { num } from "@/lib/format";
import type { ValidationItem } from "@/lib/types";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatRow } from "@/components/ui/StatRow";

/** Etiqueta en palabras de cada métrica de `validation.json`. */
const LABELS: Record<string, string> = {
  salto_2012_crudo: "Salto de 2012, suma directa",
  salto_2012_armonizado: "Salto de 2012, armonizada",
  holdout_mae_pct: "Error anual del factor",
  holdout_r: "Correlación con Aqua",
};

function formatValue(item: ValidationItem): string {
  if (item.value === null) return "pendiente";
  if (item.detail.unidad === "%") return `${item.value > 0 ? "+" : ""}${num(item.value, 1)} %`;
  return num(item.value, 2);
}

function hintOf(item: ValidationItem): string | undefined {
  if (item.detail.antes) return `${item.detail.antes} → ${item.detail.despues}`;
  if (item.detail.prueba) return `prueba ${item.detail.prueba}`;
  return undefined;
}

/** ¿Funciona la armonización? El salto de 2012 debe desaparecer y el factor debe predecir Aqua. */
export function ValidationPanel() {
  const { data: validation, isPending } = useValidation();

  return (
    <GlassPanel id="validacion" title="Validación">
      {isPending && <p className="text-[12.5px] text-muted">Cargando…</p>}
      {validation && (
        <dl>
          {validation.items.map((item) => (
            <StatRow key={item.name} label={LABELS[item.name] ?? item.name} hint={hintOf(item)} value={formatValue(item)} />
          ))}
        </dl>
      )}
      {!isPending && !validation && <p className="text-[12.5px] text-muted">Pendiente.</p>}
    </GlassPanel>
  );
}
