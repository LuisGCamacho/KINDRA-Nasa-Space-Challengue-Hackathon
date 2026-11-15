import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Series, Zone } from "@/lib/types";

vi.mock("server-only", () => ({}));

// Postgres de mentira: cada prueba decide si hay base, si responde, si falla o si tarda.
const db = vi.hoisted(() => ({
  hasDatabase: vi.fn(() => true),
  listZones: vi.fn(),
  seriesOf: vi.fn(),
  cellsOf: vi.fn(),
  latestForecast: vi.fn(),
  validationItems: vi.fn(),
  factors: vi.fn(),
}));
vi.mock("@/db/queries", () => db);

// Los JSON de respaldo van en una carpeta temporal.
const root = mkdtempSync(path.join(tmpdir(), "kindra-datos-"));
vi.spyOn(process, "cwd").mockReturnValue(root);
mkdirSync(path.join(root, "data", "series"), { recursive: true });

const zoneFromJson: Zone = {
  id: "us-ca-json",
  name: "Desde JSON",
  type: "departamento",
  country: "Estados Unidos",
  center: [-120, 37],
  bbox: [-121, 36, -119, 38],
  areaKm2: 10,
};
const zoneFromDb: Zone = { ...zoneFromJson, id: "us-ca-db", name: "Desde Postgres" };
const seriesFromJson: Series = { zoneId: "us-ca-json", months: [] };
writeFileSync(path.join(root, "data", "zones.json"), JSON.stringify([zoneFromJson]));
writeFileSync(path.join(root, "data", "series", "us-ca-json.json"), JSON.stringify(seriesFromJson));

const data = await import("@/server/data");
vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  vi.useRealTimers();
  Object.values(db).forEach((mock) => mock.mockReset());
  db.hasDatabase.mockReturnValue(true);
  data.resetDatabasePause();
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("Postgres con respaldo en JSON", () => {
  it("sin DATABASE_URL usa los JSON y no toca la base", async () => {
    db.hasDatabase.mockReturnValue(false);
    expect(await data.getZones()).toEqual([zoneFromJson]);
    expect(db.listZones).not.toHaveBeenCalled();
  });

  it("con base usa lo que responde Postgres", async () => {
    db.listZones.mockResolvedValue([zoneFromDb]);
    expect(await data.getZones()).toEqual([zoneFromDb]);
  });

  it("si la base no tiene el dato, usa el JSON", async () => {
    db.listZones.mockResolvedValue([]);
    db.seriesOf.mockResolvedValue(null);
    expect(await data.getZones()).toEqual([zoneFromJson]);
    expect(await data.getSeries("us-ca-json")).toEqual(seriesFromJson);
  });

  it("si la base falla, usa el JSON y deja de intentarla un rato", async () => {
    db.listZones.mockRejectedValue(new Error("connection refused"));
    expect(await data.getZones()).toEqual([zoneFromJson]);
    expect(await data.getSeries("us-ca-json")).toEqual(seriesFromJson);
    expect(db.listZones).toHaveBeenCalledTimes(1);
    expect(db.seriesOf).not.toHaveBeenCalled();
  });

  it("después de la pausa vuelve a intentar la base", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    db.listZones.mockRejectedValueOnce(new Error("caída")).mockResolvedValue([zoneFromDb]);
    expect(await data.getZones()).toEqual([zoneFromJson]);
    vi.setSystemTime(Date.now() + data.DB_RETRY_AFTER_MS + 1);
    expect(await data.getZones()).toEqual([zoneFromDb]);
  });

  it("si la base tarda más de 3 s, usa el JSON sin esperar más", async () => {
    vi.useFakeTimers();
    db.listZones.mockReturnValue(new Promise(() => {}));
    const zones = data.getZones();
    await vi.advanceTimersByTimeAsync(data.DB_TIMEOUT_MS + 10);
    expect(await zones).toEqual([zoneFromJson]);
  });

  it("las cámaras siempre salen del JSON (no hay consulta de cámaras)", async () => {
    expect(await data.getCameras()).toEqual([]);
    expect(db.listZones).not.toHaveBeenCalled();
  });
});
