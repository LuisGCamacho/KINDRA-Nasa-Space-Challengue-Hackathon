"use client";

import { useState } from "react";
import { Flame, X } from "lucide-react";
import type { FireAlert } from "@/lib/alert-types";
import { useAlertHotspots, useCameras, useConfirmedFireAlert, useZones } from "@/hooks/queries";
import { useOpenCamera } from "@/hooks/useOpenCamera";
import { useLensStore } from "@/store/useLensStore";
import { hotspotBounds, hotspotsMonth, satelliteName, zoneContaining } from "@/lib/hotspots";
import { formatLocalTime } from "@/lib/time";
import { num } from "@/lib/format";
import { LEVEL_COLOR } from "@/lib/colors";
import { PillButton } from "@/components/ui/PillButton";

/** Alertas que el usuario cerró en esta pestaña; al abrir otra pestaña se vuelven a avisar. */
const DISMISSED_KEY = "kindra:avisos-cerrados";

/**
 * Aviso de incendio confirmado en la pantalla principal: la cámara vio humo o llama y el agente lo
 * confirmó (con FIRMS cerca). Lleva a los focos en el mapa o a la cámara. Se cierra con la X y no
 * vuelve a salir para esa alerta en esta pestaña.
 */
export function FireAlertNotice() {
  const fire = useConfirmedFireAlert();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  if (!fire || dismissed.includes(fire.id)) return null;

  const dismiss = () => {
    const next = [...dismissed, fire.id];
    setDismissed(next);
    try {
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Sin almacenamiento (modo privado): el aviso se cierra igual hasta recargar.
    }
  };

  return <NoticeCard fire={fire} onDismiss={dismiss} />;
}

function NoticeCard({ fire, onDismiss }: { fire: FireAlert; onDismiss: () => void }) {
  const { data: cameras } = useCameras();
  const { data: zones } = useZones();
  const { data: hotspots } = useAlertHotspots(fire.id);
  const openCamera = useOpenCamera();
  const showFire = useLensStore((state) => state.showFire);
  const camera = cameras?.find((item) => item.id === fire.cameraId);

  const viirs = hotspots?.filter((point) => point.sensor === "VIIRS").length ?? 0;
  const modis = hotspots?.filter((point) => point.sensor === "MODIS").length ?? 0;
  const zone = camera && zones ? zoneContaining(zones, camera.position) : undefined;
  const month = hotspots ? hotspotsMonth(hotspots) : null;
  const canShowMap = Boolean(camera && zone && month && hotspots?.length);

  const goToMap = () => {
    if (!camera || !zone || !month || !hotspots) return;
    showFire({ zoneId: zone.id, month, bounds: hotspotBounds(hotspots, camera.position) });
  };

  return (
    <section
      role="alert"
      aria-label="Incendio confirmado"
      className="glass fixed bottom-4 right-4 z-50 w-[min(440px,calc(100%-32px))] rounded-[22px] border p-4 shadow-2xl sm:bottom-6 sm:right-6"
      style={{ borderColor: LEVEL_COLOR["Muy alto"] }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid size-8 shrink-0 animate-pulse place-items-center rounded-full"
          style={{ backgroundColor: LEVEL_COLOR["Muy alto"] }}
        >
          <Flame className="size-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-heading">Incendio confirmado · {camera?.name ?? fire.cameraId}</p>
          <p className="mt-1 text-[12.5px] text-muted">{evidenceText(fire, viirs, modis)}</p>
          <p className="mt-1 text-[11.5px] text-muted">Alerta del {formatLocalTime(fire.createdAt)} (hora de California)</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PillButton variant="primary" className="h-9" onClick={goToMap} disabled={!canShowMap}>
              Ver focos en el mapa
            </PillButton>
            <PillButton className="h-9" onClick={() => openCamera(fire.cameraId)}>
              Ver cámara
            </PillButton>
          </div>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Cerrar aviso" className="rounded-full p-1 text-muted hover:text-heading">
          <X className="size-4" />
        </button>
      </div>
    </section>
  );
}

/** Lo que vio cada fuente, con sus cifras: la cámara, el agente y los satélites. */
function evidenceText(fire: FireAlert, viirs: number, modis: number): string {
  const parts = [`La visión marcó fuego en la cámara y el agente lo confirmó (${num(fire.agent.confidence * 100)} %).`];
  if (fire.firms.found && fire.firms.source && fire.firms.nearestKm !== null) {
    parts.push(`Foco ${satelliteName(fire.firms.source)} a ${num(fire.firms.nearestKm, 1)} km.`);
  }
  if (viirs || modis) parts.push(`En el mapa: ${num(viirs)} focos VIIRS y ${num(modis)} MODIS.`);
  return parts.join(" ");
}

function readDismissed(): string[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}
