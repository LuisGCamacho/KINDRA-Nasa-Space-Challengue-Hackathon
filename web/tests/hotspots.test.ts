import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { FirmsHotspot } from "@/lib/alert-types";

// `server-only` corta la importación fuera de Next; en las pruebas no hace falta.
vi.mock("server-only", () => ({}));

// Los datos vivos de la prueba van a una carpeta temporal, nunca a web/data/live/.
const root = mkdtempSync(path.join(tmpdir(), "kindra-focos-"));
vi.spyOn(process, "cwd").mockReturnValue(root);

const { getAlertHotspots } = await import("@/server/fire-alerts");

afterAll(() => rmSync(root, { recursive: true, force: true }));

const HOTSPOT: FirmsHotspot = {
  position: [-118.55, 34.0674],
  sensor: "VIIRS",
  source: "VIIRS_NOAA20",
  acquiredAt: "2025-01-07T19:46:00Z",
  frp: 34.5,
  confidence: "n",
  distanceKm: 2.12,
};

describe("getAlertHotspots", () => {
  it("devuelve lista vacía si la alerta no tiene focos guardados", async () => {
    expect(await getAlertHotspots("alerta-sin-focos")).toEqual([]);
  });

  it("lee los focos que guardó el agente", async () => {
    const folder = path.join(root, "data", "live", "hotspots");
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, "alerta-det-demo.json"), JSON.stringify([HOTSPOT]));
    expect(await getAlertHotspots("alerta-det-demo")).toEqual([HOTSPOT]);
  });

  it("rechaza ids que saldrían de la carpeta de datos vivos", async () => {
    await expect(getAlertHotspots("../secreto")).rejects.toThrow("no permitido");
  });
});
