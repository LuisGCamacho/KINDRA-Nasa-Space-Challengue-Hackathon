"use client";

import { useState } from "react";
import { useZoneAlerts } from "@/hooks/queries";
import { monthLabel } from "@/lib/format";
import { useLensStore } from "@/store/useLensStore";
import { GlassTable } from "@/components/ui/GlassTable";
import { StatusText } from "@/components/ui/ScreenHeader";
import { Segmented, type SegmentOption } from "@/components/ui/Segmented";
import { ZoneAlertRow } from "./ZoneAlertRow";

type Filter = "todas" | "Muy alto" | "Alto";

const FILTERS: SegmentOption<Filter>[] = [
  { value: "todas", label: "Todas" },
  { value: "Muy alto", label: "Muy alto" },
  { value: "Alto", label: "Alto" },
];
const COLUMNS = ["Zona", "Cociente", "Nivel", "Desde", "Sensor"];

/** Zonas en Alto o Muy alto en el mes de la lupa (la tabla de KINDRA 3). */
export function ZoneAlertsTable() {
  const month = useLensStore((state) => state.month);
  const [filter, setFilter] = useState<Filter>("todas");
  // La API ya devuelve solo zonas en Alto o Muy alto, calculadas con los umbrales de Ajustes.
  const { data: alerts, isPending, error } = useZoneAlerts(month);

  const visible = (alerts ?? []).filter((alert) => filter === "todas" || alert.level === filter);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">Zonas · {monthLabel(month)}</h2>
        <Segmented label="Filtrar por nivel" value={filter} options={FILTERS} onChange={setFilter} />
      </div>
      {isPending && <StatusText>Cargando zonas…</StatusText>}
      {error && <StatusText>No se pudieron cargar las zonas: {error.message}</StatusText>}
      {alerts && visible.length === 0 && <StatusText>Ninguna zona en alerta para ese filtro.</StatusText>}
      {visible.length > 0 && (
        <GlassTable columns={COLUMNS} caption="Zonas en alerta">
          {visible.map((alert) => <ZoneAlertRow key={alert.zone} alert={alert} />)}
        </GlassTable>
      )}
    </div>
  );
}
