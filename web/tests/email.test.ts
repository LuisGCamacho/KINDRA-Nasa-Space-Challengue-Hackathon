import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentReport, Camera, FireAlert } from "@/lib/alert-types";

// `server-only` corta la importación fuera de Next; en las pruebas no hace falta.
vi.mock("server-only", () => ({}));

// Resend de mentira: nunca sale un correo real en las pruebas.
const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

// Datos vivos e imágenes en una carpeta temporal, nunca en web/data/live/ ni web/public/live/.
const root = mkdtempSync(path.join(tmpdir(), "kindra-correo-"));
const fixtures = path.join(process.cwd(), "tests", "fixtures");
vi.spyOn(process, "cwd").mockReturnValue(root);

const { createActionToken, readActionToken, TOKEN_TTL_SECONDS } = await import("@/server/tokens");
const { saveNewFireAlert, getFireAlert } = await import("@/server/fire-alerts");
const { recordResponse, FALSE_POSITIVE_QUEUE } = await import("@/server/alert-responses");
const { readLive } = await import("@/server/live-store");
const { sendAlertEmailOnce } = await import("@/server/email/send-alert-email");
const { buildEmailFacts, buildSubject } = await import("@/server/email/facts");
const { renderAlertEmailHtml } = await import("@/server/email/alert-email-html");
const { escapeHtml } = await import("@/server/email/escape");
const { formatCaliforniaTime } = await import("@/server/email/california-time");

const report = JSON.parse(readFileSync(path.join(fixtures, "agent-report.json"), "utf-8")) as AgentReport;
const camera: Camera = {
  id: "demo-video",
  name: "Cámara de demo",
  provider: "demo",
  position: [-122.39, 40.59],
  imageUrl: "/demo/incendio-demo.jpg",
  videoUrl: null,
  refreshSeconds: 0,
  attribution: "Video de prueba del equipo KINDRA",
  termsUrl: "/ajustes",
};

let counter = 0;
/** Alerta nueva y guardada, con un id distinto en cada prueba. */
async function newAlert(): Promise<FireAlert> {
  counter += 1;
  const alert = { ...report.alert, id: `alerta-prueba-${counter}` };
  await saveNewFireAlert(alert);
  return alert;
}

beforeEach(() => {
  vi.stubEnv("ALERT_TOKEN_SECRET", "secreto-de-prueba-con-mas-de-32-caracteres");
  vi.stubEnv("APP_URL", "http://localhost:3000/");
  vi.stubEnv("RESEND_API_KEY", "re_prueba");
  vi.stubEnv("ALERT_EMAIL_FROM", "KINDRA <alertas@ejemplo.com>");
  vi.stubEnv("ALERT_EMAIL_TO", "integrante@ejemplo.com");
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: "id-de-resend" }, error: null });
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe("tokens de los botones", () => {
  const createdAt = "2026-11-15T18:00:00Z";
  const now = Date.parse(createdAt);

  it("lee un token recién creado", () => {
    expect(readActionToken(createActionToken("alerta-1", "confirmar", createdAt), now)).toMatchObject({
      alertId: "alerta-1",
      action: "confirmar",
    });
  });

  it("rechaza un token con la acción cambiada", () => {
    const [body, signature] = createActionToken("alerta-1", "confirmar", createdAt).split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    const forged = Buffer.from(JSON.stringify({ ...payload, action: "falso_positivo" })).toString("base64url");
    expect(readActionToken(`${forged}.${signature}`, now)).toBeNull();
  });

  it("vence 72 horas después de la alerta", () => {
    const token = createActionToken("alerta-1", "confirmar", createdAt);
    expect(readActionToken(token, now + (TOKEN_TTL_SECONDS - 60) * 1000)).not.toBeNull();
    expect(readActionToken(token, now + (TOKEN_TTL_SECONDS + 60) * 1000)).toBeNull();
  });

  it("es el mismo para la misma alerta y acción, y distinto entre acciones", () => {
    const a = createActionToken("alerta-1", "confirmar", createdAt);
    expect(createActionToken("alerta-1", "confirmar", createdAt)).toBe(a);
    expect(readActionToken(createActionToken("alerta-1", "falso_positivo", createdAt), now)?.jti).not.toBe(readActionToken(a, now)?.jti);
  });

  it("un token mal armado devuelve null en vez de lanzar", () => {
    expect(readActionToken("basura", now)).toBeNull();
    expect(readActionToken("a.b.c", now)).toBeNull();
    expect(readActionToken("", now)).toBeNull();
  });
});

describe("contenido del correo", () => {
  it("usa la hora de California", () => {
    expect(formatCaliforniaTime("2026-11-15T18:02:11Z")).toContain("10:02");
  });

  it("arma las filas con los datos de la alerta y el asunto con la confianza más alta", () => {
    const facts = buildEmailFacts({ alert: report.alert, detection: report.detection, camera });
    const byLabel = Object.fromEntries(facts.map((fact) => [fact.label, fact.value]));
    expect(byLabel["Qué se vio"]).toBe("Humo 87 % · Llama 64 %");
    expect(byLabel["Cuándo"]).toMatch(/10:02, hora de California$/);
    expect(byLabel["Foco en NASA FIRMS"]).toBe("Sí. Foco VIIRS_NOAA20_NRT a 2,1 km, hace 3 h.");
    expect(byLabel["Agua cerca"]).toBe("Hidrante a 300 m; Río Río de ejemplo a 1,2 km");
    expect(buildSubject({ alert: report.alert, detection: report.detection, camera })).toBe(
      "🔥 Posible incendio · Cámara de demo · confianza 87 %",
    );
  });

  it("escapa el texto del LLM: un <script> nunca entra al HTML", () => {
    const html = renderAlertEmailHtml({
      subject: "s",
      draft: { headline: "<script>alert(1)</script>", summary: 'a "b" & c' },
      facts: [],
      links: { alertUrl: "http://x/a", confirmUrl: "http://x/c", falsePositiveUrl: "http://x/f" },
      hasImage: false,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(escapeHtml(`'"&<>`)).toBe("&#39;&quot;&amp;&lt;&gt;");
  });
});

describe("sendAlertEmailOnce", () => {
  it("manda un solo correo, con la clave de idempotencia, y marca la alerta como enviada", async () => {
    const alert = await newAlert();
    const record = await sendAlertEmailOnce({ alert, detection: report.detection, camera }, report.draft!);

    expect(record).toMatchObject({ alertId: alert.id, providerId: "id-de-resend" });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = sendMock.mock.calls[0];
    expect(options).toEqual({ idempotencyKey: `alerta-${alert.id}` });
    expect(payload).toMatchObject({ to: "integrante@ejemplo.com", from: "KINDRA <alertas@ejemplo.com>" });
    expect(payload.html).toContain("http://localhost:3000/responder?token=");
    expect(await getFireAlert(alert.id)).toMatchObject({ status: "enviada", emailedAt: record!.sentAt });

    expect(await sendAlertEmailOnce({ alert, detection: report.detection, camera }, report.draft!)).toBeNull();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("pone la imagen marcada en el cuerpo cuando Python ya la escribió", async () => {
    const frames = path.join(root, "public", "live", "frames");
    mkdirSync(frames, { recursive: true });
    writeFileSync(path.join(frames, "det-ejemplo-0001-marcada.jpg"), "imagen-de-prueba");
    const alert = await newAlert();
    await sendAlertEmailOnce({ alert, detection: report.detection, camera }, report.draft!);

    const [payload] = sendMock.mock.calls[0];
    expect(payload.html).toContain("cid:deteccion-marcada");
    expect(payload.attachments.map((a: { filename: string }) => a.filename)).toEqual([
      "deteccion-marcada.jpg",
      "deteccion-marcada-adjunta.jpg",
    ]);
  });

  it("si Resend falla, la alerta queda sin emailedAt y se puede reintentar", async () => {
    const alert = await newAlert();
    sendMock.mockResolvedValueOnce({ data: null, error: { message: "daily_quota_exceeded" } });
    await expect(sendAlertEmailOnce({ alert, detection: report.detection, camera }, report.draft!)).rejects.toThrow(
      "daily_quota_exceeded",
    );
    expect((await getFireAlert(alert.id))?.emailedAt).toBeNull();

    expect(await sendAlertEmailOnce({ alert, detection: report.detection, camera }, report.draft!)).not.toBeNull();
  });

  it("no manda nada sin configuración ni con más de un destinatario", async () => {
    const alert = await newAlert();
    vi.stubEnv("ALERT_EMAIL_TO", "a@ejemplo.com, b@ejemplo.com");
    await expect(sendAlertEmailOnce({ alert, detection: report.detection, camera }, report.draft!)).rejects.toThrow("una sola dirección");
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendAlertEmailOnce({ alert, detection: report.detection, camera }, report.draft!)).rejects.toThrow("RESEND_API_KEY");
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("recordResponse", () => {
  const response = (alertId: string, tokenId: string, action: "confirmar" | "falso_positivo" = "falso_positivo") => ({
    alertId,
    action,
    tokenId,
    via: "correo" as const,
    respondedAt: "2026-11-15T18:05:02Z",
  });

  it("guarda la respuesta, cambia el estado y suma el falso positivo a la cola", async () => {
    const alert = await newAlert();
    expect(await recordResponse(response(alert.id, "token-1"), "Era una nube baja")).toBe("registrada");
    expect((await getFireAlert(alert.id))?.status).toBe("falso_positivo");
    expect(await readLive(FALSE_POSITIVE_QUEUE, [])).toContainEqual({
      alertId: alert.id,
      note: "Era una nube baja",
      respondedAt: "2026-11-15T18:05:02Z",
    });
  });

  it("un token sirve una vez y una alerta se responde una vez", async () => {
    const alert = await newAlert();
    expect(await recordResponse(response(alert.id, "token-a", "confirmar"))).toBe("registrada");
    expect(await recordResponse(response(alert.id, "token-a", "confirmar"))).toBe("token_usado");
    expect(await recordResponse(response(alert.id, "token-b", "falso_positivo"))).toBe("ya_respondida");
    expect((await getFireAlert(alert.id))?.status).toBe("incendio_confirmado");
  });

  it("una alerta que no existe no deja una respuesta guardada", async () => {
    expect(await recordResponse(response("alerta-que-no-existe", "token-x"))).toBe("alerta_inexistente");
    const saved = await readLive<{ tokenId: string }[]>("alert-responses.json", []);
    expect(saved.some((item) => item.tokenId === "token-x")).toBe(false);
  });

  it("después de una respuesta humana, el correo ya no sale", async () => {
    const alert = await newAlert();
    await recordResponse(response(alert.id, "token-z", "confirmar"));
    expect(await sendAlertEmailOnce({ alert, detection: report.detection, camera }, report.draft!)).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
