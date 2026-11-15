"use client";

import { useZone } from "@/hooks/queries";
import { monthLabel } from "@/lib/format";
import { useLensStore } from "@/store/useLensStore";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { BulletinPreview } from "./BulletinPreview";
import { CsvPanel } from "./CsvPanel";

/** Reportes de la zona y el mes que mira la lupa: boletín en texto y CSV. */
export function ReportScreen() {
  const zoneId = useLensStore((state) => state.zoneId);
  const month = useLensStore((state) => state.month);
  const zone = useZone(zoneId);

  return (
    <section className="mx-auto max-w-5xl py-6">
      <ScreenHeader
        title="Reportes"
        lead={`${zone?.name ?? zoneId} · ${monthLabel(month)}. Para cambiar la zona o el mes, vuelve a la Lupa.`}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <BulletinPreview zoneId={zoneId} month={month} />
        <CsvPanel zoneId={zoneId} month={month} />
      </div>
    </section>
  );
}
