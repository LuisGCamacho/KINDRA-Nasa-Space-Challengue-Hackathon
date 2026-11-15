"use client";

import { useForecast } from "@/hooks/queries";
import { formatLocalTime } from "@/lib/time";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { GlassTable } from "@/components/ui/GlassTable";
import { ScreenHeader, StatusText } from "@/components/ui/ScreenHeader";
import { ForecastMetrics } from "./ForecastMetrics";
import { ForecastRow } from "./ForecastRow";

const COLUMNS = ["Zona", "Probabilidad", "Celdas con fuego esperadas", "Tendencia"];

/** Próximas 24 h: probabilidad de focos nuevos por zona, de mayor a menor. */
export function ForecastScreen() {
  const { data: forecast, isPending, error } = useForecast();

  return (
    <section className="mx-auto max-w-5xl py-6">
      <ScreenHeader
        title="Próximas 24 h"
        lead="Probabilidad de que el fuego siga o se extienda mañana en cada zona, según los focos de los últimos 7 días y la meteorología de NASA POWER."
      />
      {isPending && <StatusText>Cargando pronóstico…</StatusText>}
      {error && <StatusText>Pronóstico pendiente: {error.message}</StatusText>}
      {forecast && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div>
            <GlassTable columns={COLUMNS} caption="Pronóstico por zona">
              {forecast.zones.map((zone) => <ForecastRow key={zone.zoneId} forecast={zone} />)}
            </GlassTable>
            {forecast.zones.length === 0 && <StatusText>Ninguna zona tuvo focos en los últimos 7 días.</StatusText>}
          </div>
          <aside className="flex flex-col gap-4">
            <GlassPanel id="pronostico-modelo" title="Modelo" meta={`Emitido ${formatLocalTime(forecast.issued)}`}>
              <ForecastMetrics metrics={forecast.metrics} />
              <p className="mt-3 text-[12px] text-muted">
                Solo mira celdas que ya tuvieron fuego en la última semana: no predice igniciones nuevas.
              </p>
            </GlassPanel>
          </aside>
        </div>
      )}
    </section>
  );
}
