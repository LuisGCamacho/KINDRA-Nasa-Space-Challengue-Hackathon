import { describe, expect, it } from "vitest";
import { buildSeriesCsv, METHOD_VERSION } from "@/server/csv";
import { buildBulletin, FIRMS_ACKNOWLEDGMENT, type BulletinInput } from "@/server/bulletin";
import type { MonthRow, Series, Stats } from "@/lib/types";

function row(t: string, harm: number, viirs: number | null, partial = false): MonthRow {
  return { t, raw: harm * 2, harm, lo: harm * 0.8, hi: harm * 1.25, modis: harm, viirs, src: "VIIRS_SNPP", partial };
}

const series: Series = {
  zoneId: "us-ca-los-angeles",
  months: [row("2011-12", 3, null), row("2012-01", 13.3333, 4), row("2025-01", 15, 50, true)],
};

describe("buildSeriesCsv", () => {
  const csv = buildSeriesCsv(series);
  const lines = csv.slice(1).split("\r\n");

  it("empieza con BOM y usa ; con saltos de línea de Windows", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe(
      "mes;celdas_dia_armonizadas;limite_inferior;limite_superior;celdas_dia_crudas;modis;viirs;satelite_referencia;parcial;metodo",
    );
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("escribe coma decimal, deja vacío el dato que falta y marca los meses provisionales", () => {
    expect(lines[1]).toBe(`2011-12;3;2,4;3,75;6;3;;VIIRS_SNPP;no;${METHOD_VERSION}`);
    expect(lines[2]).toBe(`2012-01;13,3333;10,6666;16,6666;26,6666;13,3333;4;VIIRS_SNPP;no;${METHOD_VERSION}`);
    expect(lines[3]).toMatch(/^2025-01;15;.*;sí;/);
  });

  it("con from y to deja solo esos meses", () => {
    const filtered = buildSeriesCsv(series, { from: "2012-01", to: "2025-01" }).slice(1).split("\r\n");
    expect(filtered.map((line) => line.slice(0, 7))).toEqual(["mes;cel", "2012-01", "2025-01", ""]);
  });
});

function stats(overrides: Partial<Stats>): Stats {
  return {
    current: 15,
    median: 1.5,
    mean: 1.9,
    ratio: 10,
    percentile: 100,
    level: "Muy alto",
    history: [
      { year: 2001, value: 1 },
      { year: 2024, value: 4 },
    ],
    ...overrides,
  };
}

function bulletin(overrides: Partial<BulletinInput> = {}) {
  return buildBulletin({
    zoneName: "Los Angeles",
    period: { from: "2025-01", to: "2025-01" },
    kind: "harm",
    stats: stats({}),
    partial: false,
    ...overrides,
  });
}

describe("buildBulletin", () => {
  it("arma el caso de la demo con cifras de stats y el nivel", () => {
    const { text, level } = bulletin();
    expect(level).toBe("Muy alto");
    expect(text.split("\n")[0]).toBe("Los Angeles · enero de 2025 · Muy alto");
    expect(text).toContain("Se registraron 15 celdas-día de fuego (serie armonizada, en escala MODIS).");
    expect(text).toContain("Es 10,0× la mediana de enero en los 2 años anteriores (1,5 celdas-día).");
    expect(text).toContain("Es el valor más alto de enero desde 2001.");
  });

  it("siempre lleva el reconocimiento de NASA FIRMS y el aviso", () => {
    const { text } = bulletin();
    expect(text).toContain(FIRMS_ACKNOWLEDGMENT);
    expect(text).toContain("as is");
    expect(text).toContain("no es un aviso oficial");
  });

  it("explica por qué un cociente alto quedó en Normal por tener pocas celdas-día", () => {
    const { text } = bulletin({ stats: stats({ current: 3, median: 1, ratio: 3, percentile: 50, level: "Normal" }) });
    expect(text).toContain("Son menos de 10 celdas-día");
    expect(text).toContain("en los 2 años anteriores (1 celda-día).");
    expect(text).toContain("Supera al 50 % de los años anteriores.");
  });

  it("avisa los datos provisionales y nombra los períodos de varios meses", () => {
    const { text } = bulletin({ partial: true, period: { from: "2024-11", to: "2025-01" } });
    expect(text.split("\n")[0]).toBe("Los Angeles · noviembre de 2024 a enero de 2025 · Muy alto");
    expect(text).toContain("la mediana del mismo período en los 2 años anteriores");
    expect(text).toContain("Es el valor más alto del mismo período desde 2001.");
    expect(text).toContain("Incluye datos provisionales de FIRMS");
  });

  it("sin mediana para dividir lo dice en vez de inventar un cociente", () => {
    const { text } = bulletin({ stats: stats({ median: 0, ratio: null }) });
    expect(text).toContain("no tuvo fuego (mediana 0), así que no hay cociente.");
  });
});
