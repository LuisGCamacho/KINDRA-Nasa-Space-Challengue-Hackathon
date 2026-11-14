export type Level = "muy-alto" | "alto" | "normal" | "bajo";
export type Matrix = (number | null)[][]; // [año - 2001][mes 0-11]; null = sin datos aún

export type Zone = { id: string; name: string; province: string; kind: string; areaKm2: number };

export type Settings = {
  sensor: "armonizado" | "modis" | "viirs";
  confianza: "todas" | "nominal" | "alta";
  unidades: "km2" | "ha";
  altoDesde: number;
  muyAltoDesde: number;
  correoAlerta: boolean;
  resumenDiario: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  sensor: "armonizado",
  confianza: "nominal",
  unidades: "km2",
  altoDesde: 1.5,
  muyAltoDesde: 3,
  correoAlerta: true,
  resumenDiario: false,
};

export type InspectorData = {
  zone: Zone;
  mes: string; // "2026-07"
  focos: number;
  mediana: number;
  promedio: number;
  diffPct: number;
  superaPct: number;
  incertidumbrePct: number;
  sensor: string;
  ratio: number;
  level: Level;
  yearsCompared: number;
  byYear: { year: number; value: number | null }[];
};

export type AlertRow = { zone: Zone; level: Level; focos: number; ratio: number; since: string; sensor: string };
