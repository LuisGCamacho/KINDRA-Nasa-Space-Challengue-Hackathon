import { MONTHS_SHORT, num } from "@/lib/format";
import type { HarmonizationFactor } from "@/lib/types";
import { GlassTable } from "@/components/ui/GlassTable";

const COLUMNS = ["Mes", "Factor k", "Intervalo 90 %", "Años"];

/** Factor VIIRS → MODIS de cada mes: cuántos focos MODIS vale un foco VIIRS. */
export function FactorsTable({ factors }: { factors: HarmonizationFactor[] }) {
  return (
    <GlassTable columns={COLUMNS} caption="Factor mensual VIIRS a MODIS">
      {factors.map((factor) => (
        <tr key={factor.month}>
          <td className="py-3 pr-4">{MONTHS_SHORT[factor.month - 1]}</td>
          <td className="py-3 pr-4 tabular-nums">{num(factor.k, 2)}</td>
          <td className="py-3 pr-4 tabular-nums text-muted">{num(factor.kLow, 2)} a {num(factor.kHigh, 2)}</td>
          <td className="py-3 pr-4 tabular-nums text-muted">{num(factor.nYears)}</td>
        </tr>
      ))}
    </GlassTable>
  );
}
