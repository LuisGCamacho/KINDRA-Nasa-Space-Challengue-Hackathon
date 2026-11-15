import "server-only";
import type { FireAlert, FireAlertStatus } from "@/lib/alert-types";
import { readLive, updateLive } from "./live-store";

const FILE = "fire-alerts.json";

/** Estados que todavía piden atención de una persona. */
const ACTIVE: FireAlertStatus[] = ["enviada"];

/** Todas las alertas, de la más nueva a la más vieja. */
export async function listFireAlerts(): Promise<FireAlert[]> {
  const alerts = await readLive<FireAlert[]>(FILE, []);
  return alerts.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getFireAlert(alertId: string): Promise<FireAlert | null> {
  const alerts = await readLive<FireAlert[]>(FILE, []);
  return alerts.find((alert) => alert.id === alertId) ?? null;
}

/** Número del encabezado junto a "Alertas". */
export async function countActiveAlerts(): Promise<number> {
  const alerts = await readLive<FireAlert[]>(FILE, []);
  return alerts.filter((alert) => ACTIVE.includes(alert.status)).length;
}

/** Guarda una alerta nueva o reemplaza la que tiene el mismo id. */
export function saveFireAlert(alert: FireAlert): Promise<FireAlert> {
  return updateLive<FireAlert[], FireAlert>(FILE, [], (alerts) => ({
    next: [...alerts.filter((item) => item.id !== alert.id), alert],
    result: alert,
  }));
}

/** Cambia una alerta con `change`. Devuelve la alerta nueva o `null` si no existe. */
export function updateFireAlert(alertId: string, change: (alert: FireAlert) => FireAlert): Promise<FireAlert | null> {
  return updateLive<FireAlert[], FireAlert | null>(FILE, [], (alerts) => {
    const current = alerts.find((alert) => alert.id === alertId);
    if (!current) return { next: alerts, result: null };
    const updated = change(current);
    return { next: alerts.map((alert) => (alert.id === alertId ? updated : alert)), result: updated };
  });
}
