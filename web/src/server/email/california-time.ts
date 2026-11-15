/** Las cámaras de la demo están en California: la hora del correo va en hora local de allí. */
const CALIFORNIA = "America/Los_Angeles";

const TIME_FORMAT = new Intl.DateTimeFormat("es-AR", {
  timeZone: CALIFORNIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "2026-11-15T18:02:11Z" → "15/11/2026, 10:02" en hora de California (cambia sola con el horario de verano). */
export function formatCaliforniaTime(iso: string): string {
  return TIME_FORMAT.format(new Date(iso));
}
