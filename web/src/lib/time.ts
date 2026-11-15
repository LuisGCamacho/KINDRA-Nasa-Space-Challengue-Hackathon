/** Las cámaras y las zonas de la demo están en California: las horas se muestran en hora local de allí. */
const CALIFORNIA = "America/Los_Angeles";

const TIME_FORMAT = new Intl.DateTimeFormat("es-AR", {
  timeZone: CALIFORNIA,
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour12: false,
});

/** "2026-11-14T17:32:00Z" → "14/11/2026, 09:32" en hora de California (cambia sola con el horario de verano). */
export function formatLocalTime(iso: string): string {
  return TIME_FORMAT.format(new Date(iso));
}

export function formatMonthYear(mes?: string): string {
  if (!mes) return "Mes actual";
  // Ejemplo de formateo para perfiles temporales del hackathon
  return mes;
}

export function getCurrentIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}