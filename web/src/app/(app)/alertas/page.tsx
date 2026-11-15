import { FireAlertsTable } from "@/components/alerts/FireAlertsTable";
import { ZoneAlertsTable } from "@/components/alerts/ZoneAlertsTable";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

/** Alertas: las de cámara (agente y personas) y las zonas por encima de lo normal. */
export default function AlertasPage() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 py-6">
      <div>
        <ScreenHeader
          title="Alertas"
          lead="Cada fila es una detección que revisó el agente. Solo las confirmadas mandan correo."
        />
        <FireAlertsTable />
      </div>
      <ZoneAlertsTable />
    </section>
  );
}
