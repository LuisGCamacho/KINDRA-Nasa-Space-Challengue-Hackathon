import type { AlertRow, InspectorData, Matrix, Settings, ZoneView } from "./view-types";
import { levelOf } from "./levels";

/*
  CAPA DE DATOS
  Hoy devuelve datos de ejemplo. Para conectar NASA FIRMS, cambia SOLO el cuerpo de
  estas funciones (los tipos y las firmas se quedan igual) y ninguna pantalla se toca.
*/

export const FIRST_YEAR = 2001;
const LAST_Y = 2026;
const LAST_M = 7;
export const LAST_MONTH = "2026-07"; // último mes con datos

// ---------- utilidades ----------
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

// ---------- zonas (áreas y valores de ejemplo) ----------
type Seed = ZoneView & { scale: number; target: number; since: string };
const SEEDS: Seed[] = [
  { id: "chilecito", name: "Chilecito", province: "La Rioja", kind: "Departamento", areaKm2: 3470, scale: 1, target: 5.45, since: "02 jul 2026" },
  { id: "famatina", name: "Famatina", province: "La Rioja", kind: "Departamento", areaKm2: 4120, scale: 0.7, target: 2.2, since: "06 jul 2026" },
  { id: "punilla", name: "Punilla", province: "Córdoba", kind: "Departamento", areaKm2: 2590, scale: 1.4, target: 2.6, since: "05 jul 2026" },
  { id: "talampaya", name: "P. N. Talampaya", province: "La Rioja", kind: "Parque nacional", areaKm2: 2150, scale: 0.35, target: 1.6, since: "08 jul 2026" },
  { id: "delta-parana", name: "Delta del Paraná", province: "Entre Ríos", kind: "Humedal", areaKm2: 2600, scale: 2.4, target: 3.8, since: "28 jun 2026" },
  { id: "esteros-ibera", name: "Esteros del Iberá", province: "Corrientes", kind: "Humedal", areaKm2: 13000, scale: 1.1, target: 1.9, since: "30 jun 2026" },
  { id: "calamuchita", name: "Calamuchita", province: "Córdoba", kind: "Departamento", areaKm2: 2650, scale: 0.6, target: 1.7, since: "07 jul 2026" },
];
const publicZone = (z: Seed): ZoneView => ({ id: z.id, name: z.name, province: z.province, kind: z.kind, areaKm2: z.areaKm2 });
const seedOf = (id: string) => SEEDS.find((z) => z.id === id) ?? SEEDS[0];

// ---------- matriz año × mes (el calendario) ----------
const SEASON = [2, 2, 3, 5, 7, 8, 11, 17, 24, 15, 6, 3]; // forma típica del año
const cache = new Map<string, Matrix>();

function matrixFor(z: Seed): Matrix {
  const hit = cache.get(z.id);
  if (hit) return hit;
  const r = rng(hash(z.id));
  const rows: Matrix = [];
  for (let y = FIRST_YEAR; y <= LAST_Y; y++) {
    rows.push(SEASON.map((base, m) => (y === LAST_Y && m + 1 > LAST_M ? null : Math.round(base * z.scale * (0.5 + r())))));
  }
  // El mes actual: lo fijamos para que el ejemplo muestre el nivel esperado de cada zona.
  const previous = rows.slice(0, -1).map((row) => row[LAST_M - 1] as number);
  rows[rows.length - 1][LAST_M - 1] = Math.round(Math.max(1, median(previous)) * z.target);
  cache.set(z.id, rows);
  return rows;
}

function inspect(z: Seed, mes: string, s: Settings): InspectorData {
  const [year, month] = mes.split("-").map(Number);
  const series = matrixFor(z).map((row, i) => ({ year: FIRST_YEAR + i, value: row[month - 1] }));
  const focos = series.find((p) => p.year === year)?.value ?? 0;
  const others = series.filter((p) => p.year !== year && p.value !== null).map((p) => p.value as number);
  const mediana = Math.max(1, median(others));
  const promedio = mean(others);
  const ratio = focos / mediana;
  const soloModis = year <= 2011;
  return {
    zone: publicZone(z),
    mes,
    focos,
    mediana,
    promedio,
    diffPct: ((focos - promedio) / promedio) * 100,
    superaPct: (others.filter((v) => v < focos).length / others.length) * 100,
    incertidumbrePct: soloModis ? 9 : 4,
    sensor: soloModis ? "MODIS Terra + Aqua" : "VIIRS NOAA-20",
    ratio,
    level: levelOf(ratio, s.altoDesde, s.muyAltoDesde),
    yearsCompared: others.length,
    byYear: series,
  };
}

/** Acepta "YYYY-MM" válido y con datos; si no, devuelve el último mes disponible. */
export function normalizeMes(mes?: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(mes ?? "");
  if (!m) return LAST_MONTH;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const ok = y >= FIRST_YEAR && mo >= 1 && mo <= 12 && (y < LAST_Y || (y === LAST_Y && mo <= LAST_M));
  return ok ? (mes as string) : LAST_MONTH;
}

// ---------- API de datos que usan las pantallas ----------
export async function getZones(): Promise<ZoneView[]> {
  return SEEDS.map(publicZone);
}

export async function getCalendar(zonaId: string) {
  const rows = matrixFor(seedOf(zonaId));
  const max = Math.max(...rows.flat().filter((v): v is number => v !== null));
  return { rows, max, firstYear: FIRST_YEAR };
}

export async function getInspector(zonaId: string, mes: string, s: Settings) {
  return inspect(seedOf(zonaId), mes, s);
}

/** Todas las zonas en un mes (alimenta el CSV). */
export async function getMonthSummary(mes: string, s: Settings) {
  return SEEDS.map((z) => inspect(z, mes, s));
}

/** Focos para el mapa, en coordenadas 0–1. Con FIRMS: lat/lon de cada detección dentro de la zona. */
export async function getHotspots(zonaId: string, mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const n = Math.min(matrixFor(seedOf(zonaId))[y - FIRST_YEAR]?.[m - 1] ?? 0, 300);
  const r = rng(hash(zonaId + mes));
  return Array.from({ length: n }, () => ({ u: r(), v: r() }));
}

export async function getAlerts(s: Settings): Promise<AlertRow[]> {
  return SEEDS.map((z) => ({ d: inspect(z, LAST_MONTH, s), since: z.since }))
    .filter(({ d }) => d.level === "Alto" || d.level === "Muy alto")
    .sort((a, b) => b.d.ratio - a.d.ratio)
    .map(({ d, since }) => ({ zone: d.zone, level: d.level, focos: d.focos, ratio: d.ratio, since, sensor: "VIIRS" }));
}
