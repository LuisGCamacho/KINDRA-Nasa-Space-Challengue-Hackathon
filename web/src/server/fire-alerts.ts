import "server-only";
import type { FireAlert, FireAlertStatus, FirmsHotspot } from "@/lib/alert-types";
import { readLive, updateLive } from "./live-store";

const FILE = "fire-alerts.json";

/**
 * Estados que todavía piden atención de una persona:
 * `pendiente` (el agente pidió revisar) y `enviada` (salió el correo y nadie respondió).
 */
const NEEDS_ATTENTION: FireAlertStatus[] = ["pendiente", "enviada"];

/** Todas las alertas, de la más nueva a la más vieja. */
export async function listFireAlerts(): Promise<FireAlert[]> {
  const alerts = await readLive<FireAlert[]>(FILE, []);
  return alerts.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getFireAlert(alertId: string): Promise<FireAlert | null> {
  const alerts = await readLive<FireAlert[]>(FILE, []);
  return alerts.find((alert) => alert.id === alertId) ?? null;
}

/**
 * Focos de FIRMS de una alerta, del más cercano a la cámara al más lejano. Los escribe el agente
 * al mandar la alerta; una alerta vieja, de antes de que existiera este archivo, no tiene focos.
 */
export function getAlertHotspots(alertId: string): Promise<FirmsHotspot[]> {
  return readLive<FirmsHotspot[]>(`hotspots/${alertId}.json`, []);
}

/** Número del encabezado junto a "Alertas". */
export async function countActiveAlerts(): Promise<number> {
  const alerts = await readLive<FireAlert[]>(FILE, []);
  return alerts.filter((alert) => NEEDS_ATTENTION.includes(alert.status)).length;
}

/**
 * Guarda una alerta nueva del agente. Si ya existe una con el mismo id (el agente reintentó),
 * devuelve la guardada sin tocarla: así un reintento no borra la respuesta de una persona
 * ni vuelve a poner `emailedAt` en `null`.
 */
export function saveNewFireAlert(alert: FireAlert): Promise<{ alert: FireAlert; created: boolean }> {
  return updateLive<FireAlert[], { alert: FireAlert; created: boolean }>(FILE, [], (alerts) => {
    const existing = alerts.find((item) => item.id === alert.id);
    if (existing) return { next: alerts, result: { alert: existing, created: false } };
    return { next: [...alerts, alert], result: { alert, created: true } };
  });
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
