import { expect, test } from "@playwright/test";

/*
  El caso de la demo de punta a punta. Necesita los JSON reales de web/data/
  (python -m kindra export): sin datos, el diagnóstico queda en "pendiente".
*/

test("la Lupa abre en us-ca-los-angeles, julio de 2026, con el diagnóstico", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.getByRole("combobox", { name: "Zona" })).toHaveValue("ar-lr-chilecito");
  await expect(page.getByText(/lo normal/)).toBeVisible();
  await expect(page.getByText("para julio, contra la mediana de años anteriores")).toBeVisible();
});

test("Próximas 24 h y Armonización cargan sin error", async ({ page }) => {
  await page.goto("/proximas-24h");
  await expect(page.getByRole("heading", { name: "Próximas 24 h" })).toBeVisible();
  await page.goto("/armonizacion");
  await expect(page.getByRole("heading", { name: "Armonización" })).toBeVisible();
});

test("la API responde aunque no haya base de datos", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).app).toBe("ok");
});
