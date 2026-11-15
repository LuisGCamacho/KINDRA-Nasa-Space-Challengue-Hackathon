import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { AgentReport } from "@/lib/alert-types";

// `server-only` corta la importación fuera de Next; en las pruebas no hace falta.
vi.mock("server-only", () => ({}));

// Los datos vivos de la prueba van a una carpeta temporal, nunca a web/data/live/.
const root = mkdtempSync(path.join(tmpdir(), "kindra-det-"));
vi.spyOn(process, "cwd").mockReturnValue(root);

const { getLatestDetections } = await import("@/server/cameras");
const report = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "agent-report.json"), "utf-8"),
) as AgentReport;

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("getLatestDetections", () => {
  it("devuelve lista vacía si el agente todavía no escribió ninguna", async () => {
    expect(await getLatestDetections()).toEqual([]);
  });

  it("junta la última detección de cada cámara y salta archivos ajenos", async () => {
    const folder = path.join(root, "data", "live", "detections");
    mkdirSync(folder, { recursive: true });
    const other = { ...report.detection, id: "det-otra", cameraId: "caltrans-d7-cctv-196" };
    writeFileSync(path.join(folder, `${report.detection.cameraId}.json`), JSON.stringify(report.detection));
    writeFileSync(path.join(folder, "caltrans-d7-cctv-196.json"), JSON.stringify(other));
    writeFileSync(path.join(folder, "Notas.txt"), "no es una detección");

    const ids = (await getLatestDetections()).map((detection) => detection.cameraId).sort();
    expect(ids).toEqual(["caltrans-d7-cctv-196", report.detection.cameraId].sort());
  });
});
