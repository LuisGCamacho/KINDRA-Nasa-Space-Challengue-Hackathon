import { Download } from "lucide-react";
import { withQuery } from "@/lib/api";
import { addMonths } from "@/lib/period";
import { GlassPanel } from "@/components/ui/GlassPanel";

/** Descarga del CSV de la zona: los 12 meses que terminan en el mes elegido. */
export function CsvPanel({ zoneId, month }: { zoneId: string; month: string }) {
  const from = addMonths(month, -11);
  const href = withQuery("/api/reports/csv", { zone: zoneId, from, to: month });

  return (
    <GlassPanel id="csv" title="CSV" meta={`${from} a ${month}`}>
      <p className="mb-4 text-[12.5px] text-muted">
        Una fila por mes: focos armonizados con su intervalo, serie cruda, MODIS, VIIRS y el satélite usado. Se abre en Excel.
      </p>
      <a
        href={href}
        download
        className="glass inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] hover:bg-glass-strong"
      >
        <Download aria-hidden className="size-4" />
        Descargar CSV
      </a>
    </GlassPanel>
  );
}
