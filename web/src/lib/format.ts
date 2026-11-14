// Formato argentino: 1.234 focos · 5,5× · +395 %
export function num(n: number, d = 0) {
  const [i, f] = Math.abs(n).toFixed(d).split(".");
  const miles = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "−" : ""}${miles}${f ? "," + f : ""}`;
}
export const ratio = (r: number) => `${num(r, 1)}×`;
export const pct = (n: number) => `${n > 0 ? "+" : ""}${num(n)} %`;

export const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-07" → "julio" */
export const monthName = (ym: string) => MONTHS_LONG[Number(ym.split("-")[1]) - 1];
/** "2026-07" → "Julio 2026" */
export const monthLabel = (ym: string) => {
  const n = monthName(ym);
  return `${n[0].toUpperCase()}${n.slice(1)} ${ym.split("-")[0]}`;
};
