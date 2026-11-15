import { defineConfig } from "@playwright/test";

/** `npx playwright test`: levanta la app y corre el flujo de la demo. */
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
