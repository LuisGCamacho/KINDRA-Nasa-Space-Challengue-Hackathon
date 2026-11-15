const ARGENTINA = "America/Argentina/Buenos_Aires";

const TIME_FORMAT = new Intl.DateTimeFormat("es-AR", {
  timeZone: ARGENTINA,
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "2026-11-14T17:32:00Z" → "14/11/2026, 14:32" en hora de Argentina. */
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