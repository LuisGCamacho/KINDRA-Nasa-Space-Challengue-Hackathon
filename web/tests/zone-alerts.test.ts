import { describe, expect, it } from "vitest";
import { levelForPeriod } from "@/lib/levels";
import { zoneAlert, zoneAlerts } from "@/server/zone-alerts";
import type { MonthRow, Series } from "@/lib/types";

const DEFAULTS = { high: 1.5, veryHigh: 3 };

function row(t: string, harm: number): MonthRow {
  return { t, raw: harm, harm, lo: harm, hi: harm, modis: harm, viirs: harm, src: "VIIRS_SNPP", partial: false };
}

/**
 * Serie de 2020-01 a 2025-12 con 4 celdas-día por mes, salvo los meses de `overrides`.
 * Así la mediana de cada mes es 4 y es fácil armar meses en alerta.
 */
function series(zoneId: string, overrides: Record<string, number>): Series {
  const months: MonthRow[] = [];
  for (let year = 2020; year <= 2025; year++) {
    for (let month = 1; month <= 12; month++) {
      const t = `${year}-${String(month).padStart(2, "0")}`;
      months.push(row(t, overrides[t] ?? 4));
    }
  }
  return { zoneId, months };
}

describe("zoneAlert", () => {
  it("arma la fila con cociente, nivel, satélite y el inicio de la racha", () => {
    const s = series("us-ca-los-angeles", { "2025-11": 12, "2025-12": 40 });
    expect(zoneAlert(s, "2025-12", DEFAULTS)).toEqual({
      zone: "us-ca-los-angeles",
      ratio: 10,
      level: "Muy alto",
      since: "2025-11",
      sensor: "VIIRS_SNPP",
    });
  });

  it("la racha se corta en el primer mes que no está en alerta", () => {
    const s = series("z", { "2025-09": 40, "2025-10": 4, "2025-11": 12, "2025-12": 12 });
    expect(zoneAlert(s, "2025-12", DEFAULTS)?.since).toBe("2025-11");
  });

  it("no devuelve nada para un mes normal ni para menos de 10 celdas-día", () => {
    expect(zoneAlert(series("z", {}), "2025-12", DEFAULTS)).toBeNull();
    expect(zoneAlert(series("z", { "2025-12": 9 }), "2025-12", DEFAULTS)).toBeNull();
  });

  it("respeta los umbrales que se le pasan", () => {
    const s = series("z", { "2025-12": 10 });
    expect(zoneAlert(s, "2025-12", DEFAULTS)?.level).toBe("Alto");
    expect(zoneAlert(s, "2025-12", { high: 3, veryHigh: 5 })).toBeNull();
  });

  it("incluye los meses sin cociente (mediana 0) con ratio null y nivel Muy alto", () => {
    const zeros: Series = { zoneId: "z", months: [row("2024-12", 0), row("2025-12", 20)] };
    expect(zoneAlert(zeros, "2025-12", DEFAULTS)).toMatchObject({ ratio: null, level: "Muy alto" });
  });

  it("un mes sin cociente pero con menos de 10 celdas-día no es alerta", () => {
    const zeros: Series = { zoneId: "z", months: [row("2024-12", 0), row("2025-12", 9)] };
    expect(zoneAlert(zeros, "2025-12", DEFAULTS)).toBeNull();
  });

  it("no devuelve nada si la serie no llega a ese mes", () => {
    expect(zoneAlert(series("z", {}), "2026-01", DEFAULTS)).toBeNull();
  });
});

describe("zoneAlerts", () => {
  it("ordena del cociente más alto al más bajo y omite las zonas sin alerta", () => {
    const all = [series("a", { "2025-12": 12 }), series("b", {}), series("c", { "2025-12": 40 })];
    expect(zoneAlerts(all, "2025-12", DEFAULTS).map((alert) => alert.zone)).toEqual(["c", "a"]);
  });

  it("pone primero las zonas sin cociente", () => {
    const zeros: Series = { zoneId: "sin-historial", months: [row("2024-12", 0), row("2025-12", 20)] };
    const all = [series("a", { "2025-12": 12 }), zeros, series("c", { "2025-12": 40 })];
    expect(zoneAlerts(all, "2025-12", DEFAULTS).map((alert) => alert.zone)).toEqual(["sin-historial", "c", "a"]);
  });
});

describe("levelForPeriod", () => {
  it("aplica el mínimo de celdas-día también con umbrales propios", () => {
    expect(levelForPeriod(3, 3)).toBe("Normal");
    expect(levelForPeriod(3, 3, 1.2, 2)).toBe("Normal");
    expect(levelForPeriod(12, 3, 1.2, 2)).toBe("Muy alto");
    expect(levelForPeriod(3, 0.1)).toBe("Bajo");
    expect(levelForPeriod(0, null)).toBe("Normal");
    expect(levelForPeriod(12, null)).toBe("Muy alto");
  });
});
