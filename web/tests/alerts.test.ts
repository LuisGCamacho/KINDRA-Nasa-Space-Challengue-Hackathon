import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AgentReport, FireAlert } from "@/lib/alert-types";

// `server-only` corta la importación fuera de Next; en las pruebas no hace falta.
vi.mock("server-only", () => ({}));

// Los datos vivos de la prueba van a una carpeta temporal, nunca a web/data/live/.
const liveDir = mkdtempSync(path.join(tmpdir(), "kindra-live-"));
const fixtures = path.join(process.cwd(), "tests", "fixtures");
vi.spyOn(process, "cwd").mockReturnValue(liveDir);

const { readLive, updateLive } = await import("@/server/live-store");
const { getFireAlert, listFireAlerts, saveNewFireAlert, updateFireAlert, countActiveAlerts } = await import(
  "@/server/fire-alerts"
);
const { agentReportSchema, describeReportError } = await import("@/server/agent-report-schema");
const { checkAgentRequest } = await import("@/server/agent-auth");

const report = JSON.parse(readFileSync(path.join(fixtures, "agent-report.json"), "utf-8")) as AgentReport;

/** Copia del informe de ejemplo con cambios, sin tocar el original. */
function reportWith(change: (copy: AgentReport) => void): unknown {
  const copy = structuredClone(report);
  change(copy);
  return copy;
}

afterAll(() => rmSync(liveDir, { recursive: true, force: true }));

describe("live-store", () => {
  it("devuelve el valor por defecto si el archivo no existe", async () => {
    expect(await readLive("no-existe.json", [])).toEqual([]);
  });

  it("no pierde escrituras cuando llegan varias a la vez", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => updateLive<number[], void>("cola.json", [], (list) => ({ next: [...list, i], result: undefined }))),
    );
    expect((await readLive<number[]>("cola.json", [])).length).toBe(20);
  });

  it("rechaza nombres que salen de la carpeta o no son JSON", async () => {
    await expect(readLive("../afuera.json", null)).rejects.toThrow("no permitido");
    await expect(readLive("detections/../../x.json", null)).rejects.toThrow("no permitido");
    await expect(readLive("datos.txt", null)).rejects.toThrow("no permitido");
  });
});

describe("agentReportSchema", () => {
  it("acepta el informe de ejemplo", () => {
    expect(agentReportSchema.safeParse(report).success).toBe(true);
  });

  it("rechaza fechas con +00:00 y dice qué campo falló", () => {
    const result = agentReportSchema.safeParse(reportWith((r) => (r.detection.capturedAt = "2026-11-15T18:02:11+00:00")));
    expect(result.success).toBe(false);
    if (!result.success) expect(describeReportError(result.error)).toMatch(/^detection\.capturedAt: .*terminadas en Z/);
  });

  it("rechaza una confianza fuera de 0 a 1", () => {
    expect(agentReportSchema.safeParse(reportWith((r) => (r.alert.agent.confidence = 1.5))).success).toBe(false);
  });

  it("rechaza una detección que no corresponde a la alerta", () => {
    const result = agentReportSchema.safeParse(reportWith((r) => (r.alert.detectionId = "det-otra")));
    expect(!result.success && describeReportError(result.error)).toMatch(/^alert\.detectionId: /);
  });

  it("rechaza ids con barras o puntos, que romperían las rutas y los archivos", () => {
    expect(agentReportSchema.safeParse(reportWith((r) => (r.alert.cameraId = "../x"))).success).toBe(false);
  });

  it("exige status descartada solo cuando el agente descarta", () => {
    const result = agentReportSchema.safeParse(reportWith((r) => (r.alert.agent.decision = "descartar")));
    expect(!result.success && describeReportError(result.error)).toMatch(/^alert\.status: /);
  });

  it("rechaza un informe que ya trae emailedAt: el correo lo manda la API", () => {
    const result = agentReportSchema.safeParse(reportWith((r) => (r.alert.emailedAt = "2026-11-15T18:02:24Z")));
    expect(result.success).toBe(false);
  });
});

describe("fire-alerts", () => {
  beforeAll(async () => {
    await saveNewFireAlert(report.alert);
  });

  it("guarda la alerta nueva y la encuentra por id", async () => {
    expect(await getFireAlert(report.alert.id)).toEqual(report.alert);
    expect(await countActiveAlerts()).toBe(1);
  });

  it("un reintento del agente no pisa la alerta guardada", async () => {
    const answered = await updateFireAlert(report.alert.id, (alert): FireAlert => ({
      ...alert,
      status: "incendio_confirmado",
      emailedAt: "2026-11-15T18:02:24Z",
    }));
    const retry = await saveNewFireAlert(report.alert);
    expect(retry.created).toBe(false);
    expect(retry.alert).toEqual(answered);
    expect((await listFireAlerts()).length).toBe(1);
    expect(await countActiveAlerts()).toBe(0);
  });

  it("lista de la más nueva a la más vieja", async () => {
    await saveNewFireAlert({ ...report.alert, id: "alerta-mas-nueva", createdAt: "2026-11-15T20:00:00Z" });
    expect((await listFireAlerts()).map((alert) => alert.id)).toEqual(["alerta-mas-nueva", report.alert.id]);
  });
});

describe("checkAgentRequest", () => {
  const withAuth = (value?: string) => new Request("http://x/api/fire-alerts", { headers: value ? { authorization: value } : {} });

  it("distingue clave correcta, incorrecta y app sin configurar", () => {
    vi.stubEnv("AGENT_SECRET", "clave-larga-de-prueba");
    expect(checkAgentRequest(withAuth("Bearer clave-larga-de-prueba"))).toBe("ok");
    expect(checkAgentRequest(withAuth("Bearer otra"))).toBe("rechazada");
    expect(checkAgentRequest(withAuth())).toBe("rechazada");
    vi.stubEnv("AGENT_SECRET", "");
    expect(checkAgentRequest(withAuth("Bearer clave-larga-de-prueba"))).toBe("sin_configurar");
    vi.unstubAllEnvs();
  });
});
