import { beforeAll, describe, expect, it, vi } from "vitest";

// `server-only` corta la importación fuera de Next; en las pruebas no hace falta.
vi.mock("server-only", () => ({}));

const { createActionToken, readActionToken } = await import("@/server/tokens");

beforeAll(() => {
  process.env.ALERT_TOKEN_SECRET = "secreto-de-prueba-con-mas-de-32-caracteres";
});

describe("tokens de los botones del correo", () => {
  const now = Date.UTC(2026, 10, 14, 18, 0);

  it("lee un token recién creado", () => {
    const payload = readActionToken(createActionToken("alerta-1", "confirmar", now), now);
    expect(payload).toMatchObject({ alertId: "alerta-1", action: "confirmar" });
  });

  it("rechaza un token con la acción cambiada", () => {
    const [body, signature] = createActionToken("alerta-1", "confirmar", now).split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    const forged = Buffer.from(JSON.stringify({ ...payload, action: "falso_positivo" })).toString("base64url");
    expect(readActionToken(`${forged}.${signature}`, now)).toBeNull();
  });

  it("rechaza un token vencido (más de 72 h)", () => {
    const token = createActionToken("alerta-1", "confirmar", now);
    expect(readActionToken(token, now + 73 * 60 * 60 * 1000)).toBeNull();
  });

  it("cada token tiene un id distinto", () => {
    const a = readActionToken(createActionToken("alerta-1", "confirmar", now), now);
    const b = readActionToken(createActionToken("alerta-1", "confirmar", now), now);
    expect(a?.jti).not.toBe(b?.jti);
  });
});
