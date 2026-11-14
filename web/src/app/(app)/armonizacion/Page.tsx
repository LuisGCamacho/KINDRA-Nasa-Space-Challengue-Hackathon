import Link from "next/link";
import { Download, FileDown } from "lucide-react";
import { getCalendar, getHotspots, getInspector, getZones, normalizeMes } from "@/lib/data";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { monthLabel } from "@/lib/format";
import { btn, PageHeader } from "@/components/ui";
import { ZonePicker } from "@/components/ZonePicker";
import { ZoneMap } from "@/components/ZoneMap";
import { HeatCalendar } from "@/components/HeatCalendar";
import { Inspector } from "@/components/Inspector";

export default async function Armonizar({ searchParams }: { searchParams: Promise<{ zona?: string; mes?: string }> }) {
  const sp = await searchParams;
  const settings = DEFAULT_SETTINGS;
  const zones = await getZones();
  const zonaId = zones.find((z) => z.id === sp.zona)?.id ?? zones[0].id;
  const mes = normalizeMes(sp.mes);

  const [insp, cal, hotspots] = await Promise.all([
    getInspector(zonaId, mes, settings),
    getCalendar(zonaId),
    getHotspots(zonaId, mes),
  ]);

  return (
    <>
      <PageHeader
        title="Explorar"
        left={<ZonePicker zones={zones} zonaId={zonaId} mes={mes} mesLabel={monthLabel(mes)} />}
        right={
          <>
            <a href={`/api/csv?mes=${mes}`} download className={btn.secondary} aria-label="Descargar CSV">
              <Download size={16} strokeWidth={1.75} aria-hidden /> <span className="hidden sm:inline">CSV</span>
            </a>
            <Link href={`/reportes?zona=${zonaId}&mes=${mes}`} className={btn.primary} aria-label="Abrir boletín">
              <FileDown size={16} strokeWidth={1.75} aria-hidden /> <span className="hidden sm:inline">Boletín</span>
            </Link>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">
          <ZoneMap zoneName={insp.zone.name} hotspots={hotspots} />
          <HeatCalendar rows={cal.rows} max={cal.max} firstYear={cal.firstYear} zonaId={zonaId} zoneName={insp.zone.name} selected={mes} />
        </div>
        <Inspector d={insp} units={settings.unidades} />
      </div>
    </>
  );
}