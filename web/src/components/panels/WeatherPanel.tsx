"use client";

import { useLensStore } from "@/store/useLensStore";
import { useCameras, useWeather } from "@/hooks/queries";
import { num } from "@/lib/format";
import { compassPoint } from "@/lib/weather";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatRow } from "@/components/ui/StatRow";

/** Tiempo actual en la cámara: el viento dice hacia dónde puede ir el humo. */
export function WeatherPanel() {
  const cameraId = useLensStore((state) => state.cameraId);
  const { data: cameras } = useCameras();
  const camera = cameras?.find((item) => item.id === cameraId);
  const { data: weather } = useWeather(camera?.position ?? null);

  return (
    <GlassPanel id="clima" title="Tiempo en la cámara" meta="MET Norway">
      {weather ? (
        <dl>
          <StatRow label="Temperatura" value={`${num(weather.temperatureC, 1)} °C`} />
          <StatRow label="Humedad" value={`${num(weather.humidityPct)} %`} />
          <StatRow
            label="Viento"
            value={`${num(weather.windKmh)} km/h del ${compassPoint(weather.windFromDeg)}`}
          />
        </dl>
      ) : (
        <p className="text-[12.5px] text-muted">Pendiente.</p>
      )}
    </GlassPanel>
  );
}
