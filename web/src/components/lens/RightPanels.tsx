"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLensStore } from "@/store/useLensStore";
import { monthName } from "@/lib/period";
import { DiagnosisPanel } from "@/components/panels/DiagnosisPanel";
import { GroundPointPanel } from "@/components/panels/GroundPointPanel";
import { DetectionPanel } from "@/components/panels/DetectionPanel";
import { WaterSourcesPanel } from "@/components/panels/WaterSourcesPanel";
import { useCameraAlert } from "@/hooks/queries";

/** Paneles de la derecha: la respuesta para la zona y, según la lente, el punto o la detección. */
export function RightPanels() {
  const mode = useLensStore((state) => state.mode);
  const month = useLensStore((state) => state.month);

  return (
    <>
      <DiagnosisPanel />
      {mode === "camara" ? <CameraSidePanels /> : <GroundPointPanel />}
      <Link
        href={`/calendario?mes=${month}`}
        className="glass flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] hover:bg-glass-strong"
      >
        Ver {monthName(month)} en el calendario 2001–2026
        <ArrowUpRight aria-hidden className="size-4" />
      </Link>
    </>
  );
}

/** En la lente de cámara: lo detectado y, si hay alerta, el agua más cercana. */
function CameraSidePanels() {
  const cameraId = useLensStore((state) => state.cameraId);
  const alert = useCameraAlert(cameraId);
  return (
    <>
      <DetectionPanel />
      {alert && <WaterSourcesPanel alertId={alert.id} />}
    </>
  );
}
