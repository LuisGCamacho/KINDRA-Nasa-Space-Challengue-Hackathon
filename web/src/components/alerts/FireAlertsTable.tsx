"use client";

import { useFireAlerts } from "@/hooks/queries";
import { FireAlertRow } from "./FireAlertRow";

const COLUMNS = ["Hora", "Cámara", "Agente", "FIRMS", "Estado", ""];

/** Tabla de alertas de cámara. Se refresca sola cada 15 s. */
export function FireAlertsTable() {
  const { data: alerts, isPending, error } = useFireAlerts();

  if (isPending) return <p className="text-[13px] text-muted">Cargando alertas…</p>;
  if (error) return <p className="text-[13px] text-muted">No se pudieron cargar las alertas: {error.message}</p>;
  if (alerts.length === 0) return <p className="text-[13px] text-muted">Todavía no hay alertas.</p>;

  return (
    <div className="glass overflow-x-auto rounded-[22px] px-5 py-2">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line-soft text-left">
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className="py-3 pr-4 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <FireAlertRow key={alert.id} alert={alert} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
